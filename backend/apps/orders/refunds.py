"""Refund settlement, shared by every path that can refund an order.

A refund can start in two places and both must have identical consequences:

* an admin sets the order to ``refunded``, which asks Keepz to send the money
  back and then settles locally; or
* Keepz reports a refund it performed itself (operator, bank, or dispute),
  which arrives through the payment webhook with the money already returned.

Keeping the domain effects here means the gateway path cannot quietly skip the
loyalty-point reversal or the creator clawback that the admin path performs.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from .inventory import release_order_stock
from .models import Order, OrderItem, OrderStatusHistory

logger = logging.getLogger(__name__)


@dataclass
class RefundOutcome:
    already_settled: bool = False
    points_reversed: int = 0
    creator_clawed_back: bool = False
    email_sent: bool = False
    amount_refunded: Decimal = Decimal("0")
    fully_refunded: bool = False
    items_refunded: dict[int, int] = field(default_factory=dict)


def send_refund_email(
    order: Order,
    *,
    amount: Decimal | None = None,
    note: str = "",
) -> bool:
    """Tell the customer their money is coming back.

    Sends once per settlement rather than once per order: a customer who is
    refunded a second time has been sent a second sum and must be told. Callers
    are responsible for only calling this when money actually moved —
    ``settle_refund`` bails out before reaching here on a duplicate.
    """
    try:
        from apps.emails.order_context import _money, build_order_email_context
        from apps.emails.service import send_template_email

        refund_amount = amount if amount is not None else order.total
        context = build_order_email_context(order)
        context["refund_amount"] = _money(refund_amount, order.currency or "USD")
        context["refund_note"] = note
        items = list(order.items.select_related("vendor").all())
        vendor_ids = {item.vendor_id for item in items if item.vendor_id}
        vendor_obj = items[0].vendor if len(vendor_ids) == 1 and items else None
        sent = send_template_email(
            "order_refunded", order.shipping_email, context, vendor=vendor_obj
        )
        if sent:
            order.refund_email_sent_at = timezone.now()
            order.save(update_fields=["refund_email_sent_at"])
        return bool(sent)
    except Exception:
        logger.exception("Refund email failed for order %s", order.order_number)
        return False


def _resolve_refund_amount(
    order: Order,
    amount: Decimal | None,
    items: list[tuple[OrderItem, int]] | None,
) -> Decimal:
    """Work out how much money this settlement accounts for.

    Explicit per-item selections win, then an explicit amount, then whatever is
    left unrefunded on the order.
    """
    remaining = Decimal(order.total) - Decimal(order.refunded_total)
    if remaining <= 0:
        return Decimal("0")

    if items:
        total = sum(
            (item.unit_refund_amount * Decimal(qty) for item, qty in items),
            Decimal("0"),
        )
        requested = total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif amount is not None:
        requested = Decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        requested = remaining

    # Never return more than the customer actually paid.
    return min(max(requested, Decimal("0")), remaining)


def settle_refund(
    order: Order,
    *,
    note: str = "Order refunded.",
    changed_by=None,
    record_status: bool = True,
    amount: Decimal | None = None,
    items: list[tuple[OrderItem, int]] | None = None,
    notify_customer: bool = True,
    customer_note: str = "",
) -> RefundOutcome:
    """Apply every local consequence of money going back to the customer.

    Idempotent and cumulative: each call settles only the money it is given, so
    two partial refunds of the same order add up rather than double-counting.
    Never contacts the payment gateway — the caller decides whether a refund
    still needs requesting (admin) or has already happened (webhook).

    Pass ``items`` as ``[(order_item, quantity)]`` to refund specific lines; the
    amount is then derived from what those units actually cost after discounts.
    Pass ``amount`` when the gateway told us the figure. Pass neither to refund
    everything still outstanding.

    ``record_status=False`` means the caller already wrote the status and its own
    history entry, so only the reversals run here.
    """
    outcome = RefundOutcome()

    with transaction.atomic():
        locked = Order.objects.select_for_update().filter(pk=order.pk).first() or order
        order.refunded_total = locked.refunded_total

        refund_amount = _resolve_refund_amount(order, amount, items)
        if refund_amount <= 0:
            outcome.already_settled = True
            outcome.fully_refunded = Decimal(order.refunded_total) >= Decimal(order.total)
            return outcome

        for item, qty in items or []:
            take = min(qty, item.refundable_quantity)
            if take <= 0:
                continue
            item.refunded_quantity += take
            item.save(update_fields=["refunded_quantity"])
            outcome.items_refunded[item.pk] = take

        new_total = Decimal(order.refunded_total) + refund_amount
        fully = new_total >= Decimal(order.total)

        order.refunded_total = new_total
        order.save(update_fields=["refunded_total"])

        outcome.amount_refunded = refund_amount
        outcome.fully_refunded = fully

        # Only a full refund puts everything back on the shelf; a partial refund
        # must leave the still-owed items reserved for the customer.
        if fully:
            release_order_stock(order)

        target_status = "refunded" if fully else "partially_refunded"
        if record_status:
            order.status = target_status
            order.save(update_fields=["status"])
            OrderStatusHistory.objects.create(
                order=order, status=target_status, note=note, changed_by=changed_by
            )
        elif not fully and order.status == "refunded":
            # Caller assumed a full refund but the money says otherwise.
            order.status = target_status
            order.save(update_fields=["status"])

    fraction = (
        Decimal("1")
        if outcome.fully_refunded
        else (refund_amount / Decimal(order.total) if Decimal(order.total) else Decimal("1"))
    )

    try:
        from apps.gamification.services import reverse_order_points_for_refund

        reversal = reverse_order_points_for_refund(
            order,
            reason=f"Point reversal for refunded order {order.order_number}",
            fraction=fraction,
        )
        if reversal:
            outcome.points_reversed = abs(reversal.points)
    except Exception:
        logger.exception("Point reversal failed for refunded order %s", order.order_number)

    try:
        from apps.creators.services import clawback_creator_for_order

        outcome.creator_clawed_back = bool(
            clawback_creator_for_order(order, fraction=fraction)
        )
    except Exception:
        logger.exception("Creator clawback failed for refunded order %s", order.order_number)

    # `note` is internal audit text; only `customer_note` is ever shown to the buyer.
    if notify_customer:
        outcome.email_sent = send_refund_email(
            order, amount=refund_amount, note=customer_note
        )

    return outcome
