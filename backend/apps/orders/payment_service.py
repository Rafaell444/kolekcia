"""Single source of truth for Keepz payment verification and fulfillment.

The webhook (:class:`apps.orders.views.KeepzCallbackView`) and the background
reconciliation job (:mod:`apps.orders.tasks`) both funnel through
:func:`apply_verified_keepz_status`, so locking, idempotency, amount
verification and inventory handling can never drift apart between the two.

Trust model: a Keepz callback is only ever a *hint* that something changed. The
payload is never used to decide an outcome. Every terminal transition is driven
by an encrypted server-to-server read of the Keepz order status endpoint.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import NotSupportedError, connection, transaction
from django.db.models import Q
from django.utils import timezone

from .inventory import (
    InsufficientInventoryError,
    finalize_order_stock,
    hold_order_stock,
    release_order_stock,
)
from .models import Order, OrderStatusHistory, PaymentSession

logger = logging.getLogger(__name__)

PROVIDER_SUCCESS = "SUCCESS"
PROVIDER_FAILED_STATUSES = frozenset(
    {"FAILED", "REJECTED", "DECLINED", "CANCELED", "CANCELLED", "EXPIRED"}
)
#: Money has gone back to the customer. These arrive *after* a SUCCESS, so they
#: are allowed to override an already-settled payment.
#: REFUNDED_FAILED is deliberately excluded: the refund failed, so the original
#: payment still stands.
PROVIDER_REFUNDED_STATUSES = frozenset(
    {
        "REFUNDED",
        "PARTIALLY_REFUNDED",
        "REFUNDED_BY_OPERATOR",
        "REFUNDED_BY_INTEGRATOR",
        "REFUNDED_BY_KEEPZ",
    }
)

#: Order states where money has already been taken and fulfillment has started.
FULFILLED_ORDER_STATUSES = frozenset({"processing", "shipped", "delivered"})
#: Order states that must not be re-opened by a late provider update.
SETTLED_ORDER_STATUSES = FULFILLED_ORDER_STATUSES | {
    "payment_failed",
    "cancelled",
    "refunded",
    "expired",
}

#: How long reserved stock is held while a mismatched payment awaits review.
REVIEW_HOLD_DAYS = 7


class PaymentVerificationError(Exception):
    """The provider status cannot be trusted enough to change local state."""


@dataclass
class ReconcileReport:
    checked: int = 0
    updated: int = 0
    still_pending: int = 0
    failed: int = 0
    expired: int = 0
    needs_review: int = 0

    def as_line(self) -> str:
        return (
            f"Checked: {self.checked}; updated: {self.updated}; "
            f"still pending: {self.still_pending}; failed: {self.failed}; "
            f"expired: {self.expired}; needs review: {self.needs_review}"
        )


# ─── Locking ────────────────────────────────────────────────────────────────


def _locked(queryset):
    """Add ``FOR UPDATE`` when the backend supports it, otherwise pass through."""
    if not connection.features.has_select_for_update:
        return queryset
    try:
        return queryset.select_for_update()
    except NotSupportedError:
        return queryset


def lock_payment_session(payment_id) -> PaymentSession:
    """Load a payment session under a row-level lock where the backend has them.

    PostgreSQL takes a real ``SELECT ... FOR UPDATE``. SQLite has no row locks,
    so the query degrades to a plain read and correctness instead rests on the
    compare-and-swap in :func:`_claim_terminal_status` plus SQLite's
    database-wide write lock. ``NotSupportedError`` is caught rather than
    assumed absent, because backends differ on which lock variants they reject.
    """
    base = PaymentSession.objects.select_related("order", "user")
    if connection.features.has_select_for_update:
        try:
            return base.select_for_update().get(pk=payment_id)
        except NotSupportedError:
            logger.warning(
                "Row locking unavailable on %s; reading payment %s without FOR UPDATE.",
                connection.vendor,
                payment_id,
            )
    return base.get(pk=payment_id)


def _claim_terminal_status(payment: PaymentSession, new_status: str) -> bool:
    """Atomically move a payment out of a non-terminal state.

    Returns ``False`` when another worker already claimed it. This is what makes
    the flow idempotent on backends without row-level locks.
    """
    claimed = (
        PaymentSession.objects.filter(pk=payment.pk)
        .exclude(status__in=PaymentSession.TERMINAL_STATUSES)
        .update(status=new_status, updated_at=timezone.now())
    )
    return bool(claimed)


# ─── Verification ───────────────────────────────────────────────────────────


def _to_money(value) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        return None


def verify_provider_amount(payment: PaymentSession, provider_status: dict) -> str | None:
    """Confirm the authoritative status matches the amount we asked to be paid.

    Returns a human-readable reason when fulfillment must be withheld, or
    ``None`` when the payment is safe to fulfill. Keepz does not always echo the
    amount back, so an absent value only blocks fulfillment when
    ``KEEPZ_REQUIRE_AMOUNT_VERIFICATION`` is on.
    """
    require = bool(getattr(settings, "KEEPZ_REQUIRE_AMOUNT_VERIFICATION", False))

    reported_amount = _to_money(
        provider_status.get("amount")
        if provider_status.get("amount") is not None
        else provider_status.get("initialAmount")
    )
    expected_amount = _to_money(payment.amount)

    if reported_amount is None:
        if require:
            return "Keepz status omitted the paid amount, so it could not be verified."
    elif reported_amount != expected_amount:
        return (
            f"Amount mismatch: Keepz reported {reported_amount} "
            f"but this payment is for {expected_amount}."
        )

    reported_currency = str(
        provider_status.get("currency")
        or provider_status.get("initialCurrency")
        or ""
    ).upper()
    expected_currency = str(payment.currency or "").upper()

    if reported_currency:
        if reported_currency != expected_currency:
            return (
                f"Currency mismatch: Keepz reported {reported_currency} "
                f"but this payment is in {expected_currency}."
            )
    elif require:
        return "Keepz status omitted the currency, so it could not be verified."

    return None


# ─── Order-level fulfillment ────────────────────────────────────────────────


def send_order_confirmation(order: Order) -> bool:
    if order.confirmation_email_sent_at:
        return True
    try:
        from apps.emails.order_context import build_order_email_context
        from apps.emails.service import send_template_email

        items = list(order.items.select_related("vendor").all())
        vendor_ids = {item.vendor_id for item in items if item.vendor_id}
        vendor_obj = items[0].vendor if len(vendor_ids) == 1 and items else None
        sent = send_template_email(
            "order_confirmed",
            order.shipping_email,
            build_order_email_context(order),
            vendor=vendor_obj,
        )
        if sent:
            order.confirmation_email_sent_at = timezone.now()
            order.save(update_fields=["confirmation_email_sent_at"])
        return sent
    except Exception:
        logger.exception("Order confirmation email failed for order %s", order.order_number)
        return False


def finalize_paid_order(order: Order, payment: PaymentSession | None = None) -> None:
    """Convert a paid order into a fulfillable one exactly once.

    Safe to call repeatedly: stock is only drawn down from reservations that are
    still active, and the confirmation email is guarded by its own timestamp so
    a retry can repair a send that failed the first time.
    """
    if order.status not in FULFILLED_ORDER_STATUSES:
        finalize_order_stock(order)
        order.status = "processing"
        order.save(update_fields=["status"])
        OrderStatusHistory.objects.create(
            order=order,
            status="processing",
            note="Payment successful — order is being processed.",
            changed_by=order.user,
        )
        try:
            from apps.creators.services import credit_creator_for_paid_order

            credit_creator_for_paid_order(order)
        except Exception:
            logger.exception("Creator credit failed for paid order %s", order.order_number)
        if order.promo_code_id and order.user_id:
            from apps.promo.models import PromoCodeUsage

            PromoCodeUsage.objects.get_or_create(
                promo=order.promo_code, user=order.user, order=order
            )
        try:
            from apps.gamification.services import create_pending_purchase_points

            create_pending_purchase_points(order)
        except Exception:
            logger.exception("Pending points failed for paid order %s", order.order_number)
        try:
            from apps.referrals.services import process_referral_conversion

            process_referral_conversion(order.user)
        except Exception:
            logger.exception("Referral conversion failed for paid order %s", order.order_number)
    send_order_confirmation(order)


def mark_order_payment_failed(
    order: Order, note: str = "Payment failed or was cancelled."
) -> None:
    if order.status in SETTLED_ORDER_STATUSES:
        return
    release_order_stock(order)
    order.status = "payment_failed"
    order.save(update_fields=["status"])
    OrderStatusHistory.objects.create(
        order=order, status="payment_failed", note=note, changed_by=order.user
    )


def mark_order_expired(order: Order, note: str) -> None:
    if order.status in SETTLED_ORDER_STATUSES:
        return
    release_order_stock(order)
    order.status = "expired"
    order.save(update_fields=["status"])
    OrderStatusHistory.objects.create(
        order=order, status="expired", note=note, changed_by=order.user
    )


# ─── Core state machine ─────────────────────────────────────────────────────


def _record_provider_evidence(
    payment: PaymentSession, provider_status: dict, callback_payload: dict | None
) -> None:
    if callback_payload is not None:
        payment.callback_payload = callback_payload
    payment.response_payload = {
        **(payment.response_payload or {}),
        "verified_status": provider_status,
    }
    transaction_id = provider_status.get("transactionId")
    if callback_payload:
        transaction_id = transaction_id or callback_payload.get("transactionId")
    if transaction_id:
        payment.provider_transaction_id = str(transaction_id)


def _hold_for_review(payment: PaymentSession, reason: str) -> str:
    logger.error(
        "Keepz payment %s held for manual review: %s",
        payment.integrator_order_id,
        reason,
    )
    payment.status = PaymentSession.STATUS_NEEDS_REVIEW
    payment.last_error = reason[:2000]
    payment.save(
        update_fields=[
            "status",
            "last_error",
            "provider_transaction_id",
            "callback_payload",
            "response_payload",
            "updated_at",
        ]
    )
    if payment.order_id:
        # Keep the goods off sale while a human decides what happened.
        hold_order_stock(payment.order, until=timezone.now() + timedelta(days=REVIEW_HOLD_DAYS))
        OrderStatusHistory.objects.create(
            order=payment.order,
            status=payment.order.status,
            note=f"Payment held for manual review: {reason}",
            changed_by=None,
        )
    return payment.status


def _apply_success(payment: PaymentSession, provider_status: dict) -> str:
    mismatch = verify_provider_amount(payment, provider_status)
    if mismatch:
        return _hold_for_review(payment, mismatch)

    already_success = payment.status == PaymentSession.STATUS_SUCCESS
    if not already_success and not _claim_terminal_status(
        payment, PaymentSession.STATUS_SUCCESS
    ):
        # Another worker won the race. Reload so we report its outcome.
        payment.refresh_from_db(fields=["status"])
        if payment.status != PaymentSession.STATUS_SUCCESS:
            return payment.status
        already_success = True

    payment.status = PaymentSession.STATUS_SUCCESS
    payment.paid_at = payment.paid_at or timezone.now()
    payment.save(
        update_fields=[
            "status",
            "paid_at",
            "provider_transaction_id",
            "callback_payload",
            "response_payload",
            "updated_at",
        ]
    )

    if payment.order_id:
        # The customer's money is already taken at this point. If the goods were
        # resold while the payment was in flight we must not lose the payment:
        # roll back the partial stock writes via a savepoint and quarantine it
        # for a human, rather than letting the error bubble up and leave the
        # order to be expired later as if it had never been paid.
        try:
            with transaction.atomic():
                finalize_paid_order(payment.order, payment)
        except InsufficientInventoryError as exc:
            return _hold_for_review(
                payment, f"Paid, but stock could no longer be fulfilled: {exc}"
            )
    elif payment.purpose == PaymentSession.PURPOSE_POINTS_SHIPPING and payment.related_id:
        from apps.gamification.services import complete_shipping_payment_session

        complete_shipping_payment_session(payment.user, payment.related_id)
    elif payment.purpose == PaymentSession.PURPOSE_CUSTOM_ORDER and payment.related_id:
        from .models import CustomOrder

        custom_order = _locked(CustomOrder.objects).filter(pk=payment.related_id).first()
        if custom_order and custom_order.status != "paid":
            custom_order.status = "paid"
            custom_order.paid_at = payment.paid_at
            custom_order.payment_url = ""
            custom_order.save(update_fields=["status", "paid_at", "payment_url"])
    elif payment.purpose == PaymentSession.PURPOSE_AUCTION and payment.related_id:
        from apps.auctions.models import Auction

        auction = Auction.objects.filter(pk=payment.related_id).first()
        if auction and auction.winner_payment_status != Auction.PAYMENT_PAID:
            auction.winner_payment_status = Auction.PAYMENT_PAID
            auction.status = Auction.STATUS_BOUGHT
            auction.paid_at = payment.paid_at
            if not auction.winning_amount:
                auction.winning_amount = auction.current_bid
            auction.save(
                update_fields=[
                    "winner_payment_status",
                    "status",
                    "paid_at",
                    "winning_amount",
                ]
            )
    return payment.status


def _provider_refunded_amount(provider_status: dict) -> Decimal | None:
    """Pull the refunded sum out of a Keepz status body, if it reports one.

    A partial refund must only reverse the share of the order it actually
    returned, so guessing the full total here would cost the customer loyalty
    points and the creator commission they are still owed.
    """
    for key in ("refundedAmount", "refundAmount", "totalRefundedAmount"):
        value = provider_status.get(key)
        if value in (None, ""):
            continue
        parsed = _to_money(value)
        if parsed is not None and parsed > 0:
            return parsed
    return None


def _apply_refund(
    payment: PaymentSession, keepz_status: str, provider_status: dict | None = None
) -> str:
    """Settle a refund Keepz already performed.

    No refund is requested here — the money is back with the customer by the
    time this status appears. Settlement is delegated to the shared refund
    service so the loyalty and creator reversals match an admin-led refund.
    """
    partial = keepz_status == "PARTIALLY_REFUNDED"
    refunded_amount = _provider_refunded_amount(provider_status or {})

    if payment.status == PaymentSession.STATUS_REFUNDED and not partial:
        return payment.status

    logger.warning(
        "Keepz reported %s for payment %s — halting fulfillment.",
        keepz_status,
        payment.integrator_order_id,
    )
    payment.status = PaymentSession.STATUS_REFUNDED
    payment.last_error = f"Keepz reported {keepz_status}."
    payment.save(
        update_fields=[
            "status",
            "last_error",
            "provider_transaction_id",
            "callback_payload",
            "response_payload",
            "updated_at",
        ]
    )
    if payment.order_id:
        from .refunds import settle_refund

        if partial and refunded_amount is None:
            # Refusing to guess: reversing the whole order would overcharge the
            # customer's points and the creator's balance.
            logger.error(
                "Keepz reported PARTIALLY_REFUNDED for payment %s without an amount; "
                "order %s needs manual settlement.",
                payment.integrator_order_id,
                payment.order.order_number,
            )
            _hold_for_review(
                payment,
                "Partial refund reported without an amount — settle the refund manually.",
            )
            return payment.status

        settle_refund(
            payment.order,
            note=f"Keepz payment status: {keepz_status}",
            amount=refunded_amount,
        )
    return payment.status


def _apply_failure(payment: PaymentSession, keepz_status: str) -> str:
    if keepz_status in {"CANCELED", "CANCELLED"}:
        payment.status = PaymentSession.STATUS_CANCELED
    elif keepz_status == "EXPIRED":
        payment.status = PaymentSession.STATUS_EXPIRED
    else:
        payment.status = PaymentSession.STATUS_FAILED
    payment.failed_at = payment.failed_at or timezone.now()
    payment.save(
        update_fields=[
            "status",
            "failed_at",
            "provider_transaction_id",
            "callback_payload",
            "response_payload",
            "updated_at",
        ]
    )

    if payment.order_id:
        mark_order_payment_failed(payment.order, f"Keepz payment status: {keepz_status}")
    elif payment.purpose == PaymentSession.PURPOSE_AUCTION and payment.related_id:
        from apps.auctions.models import Auction

        Auction.objects.filter(pk=payment.related_id).update(
            winner_payment_status=Auction.PAYMENT_FAILED
        )
    return payment.status


def apply_verified_keepz_status(
    payment_id, provider_status: dict, callback_payload: dict | None = None
) -> str:
    """Apply a server-verified Keepz status to local state, exactly once.

    ``provider_status`` must come from the Keepz status endpoint, never from a
    webhook body. Returns the resulting local :class:`PaymentSession` status.
    """
    provider_order_id = str(provider_status.get("integratorOrderId") or "")
    keepz_status = str(provider_status.get("status") or "").upper()

    with transaction.atomic():
        payment = lock_payment_session(payment_id)

        if provider_order_id != str(payment.integrator_order_id):
            raise PaymentVerificationError("Keepz status identifier mismatch.")

        _record_provider_evidence(payment, provider_status, callback_payload)

        # Checked before the terminal guard: a refund legitimately follows a
        # SUCCESS, and must be able to stop an order that is already processing.
        if keepz_status in PROVIDER_REFUNDED_STATUSES:
            return _apply_refund(payment, keepz_status, provider_status)

        # A settled payment is never re-opened by a later non-success report.
        if payment.status in PaymentSession.TERMINAL_STATUSES and keepz_status != PROVIDER_SUCCESS:
            return payment.status

        if keepz_status == PROVIDER_SUCCESS:
            return _apply_success(payment, provider_status)
        if keepz_status in PROVIDER_FAILED_STATUSES:
            return _apply_failure(payment, keepz_status)

        # Still in flight (PENDING/PROCESSING/…): record evidence only.
        payment.save(
            update_fields=[
                "provider_transaction_id",
                "callback_payload",
                "response_payload",
                "updated_at",
            ]
        )
        return payment.status


# ─── Expiry ─────────────────────────────────────────────────────────────────


def expire_payment_session(payment_id, *, note: str | None = None) -> bool:
    """Abandon a payment that never reached a terminal state, freeing its stock."""
    reason = note or (
        "Expired: Keepz never reported a terminal status within the recovery window."
    )
    with transaction.atomic():
        payment = lock_payment_session(payment_id)
        if payment.status not in PaymentSession.PENDING_STATUSES:
            return False
        payment.status = PaymentSession.STATUS_EXPIRED
        payment.failed_at = payment.failed_at or timezone.now()
        payment.last_error = reason
        payment.save(
            update_fields=["status", "failed_at", "last_error", "updated_at"]
        )
        if payment.order_id:
            mark_order_expired(payment.order, reason)
    logger.info("Expired stale Keepz payment %s", payment.integrator_order_id)
    return True


def expire_stale_payments(*, max_age_hours: int | None = None, limit: int = 100) -> int:
    """Expire pending payments past the recovery window and release their stock."""
    if max_age_hours is None:
        max_age_hours = int(getattr(settings, "KEEPZ_RECONCILE_MAX_AGE_HOURS", 24))
    cutoff = timezone.now() - timedelta(hours=max_age_hours)
    stale_ids = list(
        PaymentSession.objects.filter(
            provider=PaymentSession.PROVIDER_KEEPZ,
            status__in=PaymentSession.PENDING_STATUSES,
            created_at__lt=cutoff,
        )
        .order_by("created_at")
        .values_list("pk", flat=True)[:limit]
    )
    return sum(1 for pk in stale_ids if expire_payment_session(pk))


# ─── Reconciliation driver ──────────────────────────────────────────────────


def _default_status_fetcher(integrator_order_id: str) -> dict:
    from .keepz import get_keepz_order_status

    return get_keepz_order_status(integrator_order_id)


def _claim_queryset(queryset):
    """Take rows no other worker is already holding.

    On PostgreSQL this is ``FOR UPDATE SKIP LOCKED``, so parallel Celery workers
    partition the batch between themselves instead of all fetching the same
    sessions and racing on the same Keepz API calls. SQLite has neither, so it
    falls back to a plain read; correctness there still rests on the
    compare-and-swap in :func:`_claim_terminal_status`.
    """
    features = connection.features
    if not (features.has_select_for_update and features.has_select_for_update_skip_locked):
        return queryset
    try:
        return queryset.select_for_update(skip_locked=True)
    except NotSupportedError:
        return queryset


def _sessions_needing_repair(min_age_seconds: int, max_age_hours: int, limit: int):
    now = timezone.now()
    webhook_cutoff = now - timedelta(seconds=min_age_seconds)
    recovery_cutoff = now - timedelta(hours=max_age_hours)
    needs_repair = (
        Q(status__in=PaymentSession.PENDING_STATUSES)
        | Q(status=PaymentSession.STATUS_SUCCESS, order__status="pending_payment")
        | Q(
            status=PaymentSession.STATUS_SUCCESS,
            order__isnull=False,
            order__confirmation_email_sent_at__isnull=True,
        )
    )
    base = (
        PaymentSession.objects.select_related("order")
        .filter(provider=PaymentSession.PROVIDER_KEEPZ)
        .filter(needs_repair)
        .filter(created_at__gte=recovery_cutoff, created_at__lte=webhook_cutoff)
        .order_by("created_at")
    )
    # Claim inside a short transaction; each session is then verified and
    # fulfilled in its own transaction so one slow Keepz call cannot hold locks
    # across the whole batch.
    with transaction.atomic():
        return list(_claim_queryset(base)[:limit])


def reconcile_keepz_payments(
    *,
    status_fetcher=None,
    min_age_seconds: int | None = None,
    max_age_hours: int | None = None,
    limit: int | None = None,
    on_error=None,
) -> ReconcileReport:
    """Recover payments whose webhook was delayed, lost, or never delivered.

    ``status_fetcher`` is injectable so callers (and tests) can supply their own
    transport. Anything past ``max_age_hours`` is expired instead of polled.
    """
    if min_age_seconds is None:
        min_age_seconds = int(getattr(settings, "KEEPZ_RECONCILE_MIN_AGE_SECONDS", 300))
    if max_age_hours is None:
        max_age_hours = int(getattr(settings, "KEEPZ_RECONCILE_MAX_AGE_HOURS", 24))
    if limit is None:
        limit = int(getattr(settings, "KEEPZ_RECONCILE_BATCH_LIMIT", 25))
    fetch_status = status_fetcher or _default_status_fetcher

    report = ReconcileReport()
    report.expired = expire_stale_payments(max_age_hours=max_age_hours, limit=limit)

    payments = _sessions_needing_repair(min_age_seconds, max_age_hours, limit)
    report.checked = len(payments)

    for payment in payments:
        try:
            provider_status = fetch_status(str(payment.integrator_order_id))
            before = payment.status
            current = apply_verified_keepz_status(payment.pk, provider_status)
            PaymentSession.objects.filter(pk=payment.pk).update(last_error="")
            if current == PaymentSession.STATUS_NEEDS_REVIEW:
                report.needs_review += 1
            elif current == before and current in PaymentSession.PENDING_STATUSES:
                report.still_pending += 1
            else:
                report.updated += 1
        except Exception as exc:
            report.failed += 1
            PaymentSession.objects.filter(pk=payment.pk).update(last_error=str(exc)[:2000])
            logger.warning(
                "Keepz reconciliation failed for %s: %s", payment.integrator_order_id, exc
            )
            if on_error is not None:
                on_error(payment, exc)

    return report
