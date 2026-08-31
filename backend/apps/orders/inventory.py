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


def reserve_order_stock(order: Order) -> None:
    minutes = max(1, int(getattr(settings, "PAYMENT_STOCK_RESERVATION_MINUTES", 15)))
    expires_at = timezone.now() + timedelta(minutes=minutes)
    items = list(order.items.select_related("variant", "size_variant"))

    variant_ids = [item.variant_id for item in items if item.variant_id]
    size_variant_ids = [item.size_variant_id for item in items if item.size_variant_id]
    variants = {
        item.pk: item for item in ProductVariant.objects.select_for_update().filter(pk__in=variant_ids)
    }
    size_variants = {
        item.pk: item for item in SizeVariant.objects.select_for_update().filter(pk__in=size_variant_ids)
    }

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


def finalize_order_stock(order: Order) -> None:
    now = timezone.now()
    reservations = list(
        StockReservation.objects.select_for_update()
        .filter(order=order, status=StockReservation.STATUS_ACTIVE)
        .select_related("variant", "size_variant")
    )
    for reservation in reservations:
        if reservation.variant_id:
            target = ProductVariant.objects.select_for_update().get(pk=reservation.variant_id)
        else:
            target = SizeVariant.objects.select_for_update().get(pk=reservation.size_variant_id)
        if target.stock is not None:
            if target.stock < reservation.quantity:
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
