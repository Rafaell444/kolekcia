from decimal import Decimal, ROUND_HALF_UP

from django.core.cache import cache
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.products.models import SizeVariant


FX_CACHE_KEY = "auction_usd_gel_nbg_rate"


def get_usd_gel_rate():
    """Return the current NBG USD/GEL rate, falling back to the latest cached NBG rate."""
    cached = cache.get(FX_CACHE_KEY)
    if cached:
        return Decimal(str(cached))

    from apps.creators.services import fetch_nbg_rate

    rate = fetch_nbg_rate("USD")
    if rate and rate > 0:
        cache.set(FX_CACHE_KEY, str(rate), timeout=60 * 60)
        return Decimal(rate)
    return None


def usd_to_gel(amount, rate=None):
    rate = rate or get_usd_gel_rate()
    if rate is None:
        return None
    return (Decimal(amount) * Decimal(rate)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def gel_to_usd(amount, rate=None):
    rate = rate or get_usd_gel_rate()
    if rate is None:
        return None
    return (Decimal(amount) / Decimal(rate)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@transaction.atomic
def reserve_auction_inventory(auction, size_variant_id=None):
    """Move one ready-to-ship unit out of catalog inventory for an auction."""
    if not auction.product_id or auction.inventory_reserved:
        return auction

    variants = SizeVariant.objects.select_for_update().filter(
        product_id=auction.product_id,
        is_active=True,
        is_ready_to_ship=True,
        stock__gt=0,
    )
    if size_variant_id:
        variants = variants.filter(pk=size_variant_id)

    available = list(variants[:2])
    if not available:
        raise ValidationError({
            "reserved_size_variant_id": "Select an in-stock, ready-to-ship variant for this auction."
        })
    if len(available) > 1:
        raise ValidationError({
            "reserved_size_variant_id": "This product has multiple ready-to-ship variants. Select the unit to auction."
        })

    variant = available[0]
    was_last = variant.stock == 1
    if was_last:
        if not auction.product.processing_options.filter(is_active=True).exists():
            raise ValidationError({
                "reserved_size_variant_id": (
                    "The final ready-to-ship unit cannot be auctioned until the product has an active processing time."
                )
            })
        variant.stock = None
        variant.is_ready_to_ship = False
    else:
        variant.stock -= 1
    variant.save(update_fields=("stock", "is_ready_to_ship"))

    auction.reserved_size_variant = variant
    auction.inventory_reserved = True
    auction.inventory_was_last_ready_unit = was_last
    auction.save(update_fields=(
        "reserved_size_variant", "inventory_reserved", "inventory_was_last_ready_unit"
    ))
    return auction


@transaction.atomic
def release_auction_inventory(auction):
    """Return an unpaid/cancelled auction unit to ready-to-ship catalog stock."""
    if not auction.inventory_reserved or not auction.reserved_size_variant_id:
        return auction

    variant = SizeVariant.objects.select_for_update().get(pk=auction.reserved_size_variant_id)
    variant.stock = 1 if auction.inventory_was_last_ready_unit else (variant.stock or 0) + 1
    variant.is_ready_to_ship = True
    variant.save(update_fields=("stock", "is_ready_to_ship"))

    auction.reserved_size_variant = None
    auction.inventory_reserved = False
    auction.inventory_was_last_ready_unit = False
    auction.save(update_fields=(
        "reserved_size_variant", "inventory_reserved", "inventory_was_last_ready_unit"
    ))
    return auction
