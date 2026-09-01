from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.products.models import ProductVariant, SizeVariant

from .models import Order, StockReservation


class InsufficientInventoryError(Exception):
    pass


def _active_reservations():
    return StockReservation.objects.filter(
        status=StockReservation.STATUS_ACTIVE,
        expires_at__gt=timezone.now(),
    )


def reserved_quantity(*, variant_id=None, size_variant_id=None) -> int:
    reservations = _active_reservations()
    if variant_id is not None:
        reservations = reservations.filter(variant_id=variant_id)
    elif size_variant_id is not None:
        reservations = reservations.filter(size_variant_id=size_variant_id)
    else:
        return 0
    return reservations.aggregate(total=Sum("quantity"))["total"] or 0


def available_quantity(target) -> int | None:
    if target.stock is None:
        return None
    reserved = reserved_quantity(
        variant_id=target.pk if isinstance(target, ProductVariant) else None,
        size_variant_id=target.pk if isinstance(target, SizeVariant) else None,
    )
    return max(int(target.stock) - int(reserved), 0)


def _lock_stock_targets(items):
    variant_ids = [item.variant_id for item in items if item.variant_id]
    size_variant_ids = [item.size_variant_id for item in items if item.size_variant_id]
    variants = {
        item.pk: item for item in ProductVariant.objects.select_for_update()
        .filter(pk__in=variant_ids).order_by("pk")
    }
    size_variants = {
        item.pk: item for item in SizeVariant.objects.select_for_update()
        .filter(pk__in=size_variant_ids).order_by("pk")
    }
    return variants, size_variants


@transaction.atomic
def reserve_order_stock(order: Order) -> None:
    Order.objects.select_for_update().get(pk=order.pk)
    minutes = max(1, int(getattr(settings, "PAYMENT_STOCK_RESERVATION_MINUTES", 15)))
    expires_at = timezone.now() + timedelta(minutes=minutes)
    items = list(order.items.all())
    variants, size_variants = _lock_stock_targets(items)

    for item in items:
        target = variants.get(item.variant_id) if item.variant_id else size_variants.get(item.size_variant_id)
        if target is None or target.stock is None:
            continue
        if item.size_variant_id and item.processing_option:
            continue
        available = available_quantity(target)
        if available is None or available < item.quantity:
            raise InsufficientInventoryError(f"'{item.product_title}' has insufficient available stock.")
        StockReservation.objects.create(
            order=order,
            order_item=item,
            variant_id=item.variant_id,
            size_variant_id=item.size_variant_id,
            quantity=item.quantity,
            expires_at=expires_at,
        )


@transaction.atomic
def finalize_order_stock(order: Order) -> None:
    Order.objects.select_for_update().get(pk=order.pk)
    now = timezone.now()
    pending = StockReservation.objects.filter(
        order=order,
        status__in=[StockReservation.STATUS_ACTIVE, StockReservation.STATUS_RELEASED],
    )
    # Match checkout's lock order: product variants, size variants, reservations.
    variants, size_variants = _lock_stock_targets(list(pending))
    reservations = list(pending.select_for_update().order_by("pk"))
    for reservation in reservations:
        target = (variants.get(reservation.variant_id) if reservation.variant_id
                  else size_variants.get(reservation.size_variant_id))
        if target is None:
            raise InsufficientInventoryError("Reserved stock is no longer available.")
        if target.stock is not None:
            others = _active_reservations().exclude(order=order)
            if reservation.variant_id:
                others = others.filter(variant_id=reservation.variant_id)
            else:
                others = others.filter(size_variant_id=reservation.size_variant_id)
            held_elsewhere = others.aggregate(total=Sum("quantity"))["total"] or 0
            if target.stock - held_elsewhere < reservation.quantity:
                raise InsufficientInventoryError("Reserved stock is no longer available.")
            target.stock -= reservation.quantity
            target.save(update_fields=["stock"])
        reservation.status = StockReservation.STATUS_FINALIZED
        reservation.finalized_at = now
        reservation.save(update_fields=["status", "finalized_at"])


def release_order_stock(order: Order) -> None:
    now = timezone.now()
    StockReservation.objects.filter(
        order=order,
        status=StockReservation.STATUS_ACTIVE,
    ).update(status=StockReservation.STATUS_RELEASED, released_at=now)


def hold_order_stock(order: Order, *, until) -> int:
    """Extend active reservations so goods stay off sale past the usual window.

    Used when a payment is quarantined for manual review: releasing the stock
    would oversell if the payment turns out to be genuine, and letting the
    reservation lapse on its own has the same effect.
    """
    return StockReservation.objects.filter(
        order=order,
        status=StockReservation.STATUS_ACTIVE,
        expires_at__lt=until,
    ).update(expires_at=until)
