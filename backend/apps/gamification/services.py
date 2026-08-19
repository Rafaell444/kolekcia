from __future__ import annotations

import hashlib
import json
import secrets
import string
import uuid
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from .models import (
    IdempotencyKey,
    LoyaltyTier,
    PointTransaction,
    PointsMarketItem,
    PointsMarketRedemption,
    PointsMarketShippingPaymentSession,
)

CHUNIN_THRESHOLD = 350
JONIN_THRESHOLD = 1000
POINTS_PER_CURRENCY_UNIT = Decimal("0.5")
TIER_SALE_BONUS_PERCENTS = {
    LoyaltyTier.GENIN: Decimal("0"),
    LoyaltyTier.CHUNIN: Decimal("5"),
    LoyaltyTier.JONIN: Decimal("10"),
}


@dataclass(frozen=True)
class TierInfo:
    key: str
    label: str
    discount_percent: Decimal
    threshold: int
    next_key: str | None
    next_label: str | None
    next_threshold: int | None


@dataclass(frozen=True)
class DiscountDecision:
    discount: Decimal
    source: str
    tier_discount: Decimal
    voucher_discount: Decimal
    tier_percent: Decimal
    voucher_percent: Decimal | None
    ignored_source: str
    message: str


@dataclass(frozen=True)
class PointsMarketPurchaseResult:
    response_data: dict
    replayed: bool


def get_tier_for_points(point_balance: int) -> TierInfo:
    """Tier is based on current spendable point balance, so users can downgrade."""
    if point_balance >= JONIN_THRESHOLD:
        return TierInfo(LoyaltyTier.JONIN, "Jonin", TIER_SALE_BONUS_PERCENTS[LoyaltyTier.JONIN], JONIN_THRESHOLD, None, None, None)
    if point_balance >= CHUNIN_THRESHOLD:
        return TierInfo(LoyaltyTier.CHUNIN, "Chunin", TIER_SALE_BONUS_PERCENTS[LoyaltyTier.CHUNIN], CHUNIN_THRESHOLD, LoyaltyTier.JONIN, "Jonin", JONIN_THRESHOLD)
    return TierInfo(LoyaltyTier.GENIN, "Genin", TIER_SALE_BONUS_PERCENTS[LoyaltyTier.GENIN], 0, LoyaltyTier.CHUNIN, "Chunin", CHUNIN_THRESHOLD)


def calculate_tier_eligible_subtotal(user, line_items) -> tuple[Decimal, TierInfo]:
    """Return sale-product subtotal eligible for the automatic tier sale bonus."""
    tier = get_tier_for_points(getattr(user, "spendable_points", 0) or 0)
    eligible_subtotal = Decimal("0")
    for item in line_items:
        product, line_subtotal = item[0], item[1]
        is_sale = bool(item[2]) if len(item) > 2 else bool(getattr(product, "is_sale", False))
        if product and is_sale:
            eligible_subtotal += Decimal(line_subtotal or 0)
    return eligible_subtotal, tier


def calculate_voucher_discount_for_lines(promo, line_items) -> Decimal:
    """Vouchers apply only to non-sale products. Sale items are reserved for tier bonus."""
    if not promo:
        return Decimal("0")
    non_sale_lines = [(product, Decimal(subtotal or 0)) for product, subtotal, is_sale in line_items if product and not is_sale]
    if not non_sale_lines:
        return Decimal("0")
    if promo.owner_id:
        subtotal = sum((subtotal for _, subtotal in non_sale_lines), Decimal("0"))
        return promo.calculate_product_discount(subtotal).quantize(Decimal("0.01"))
    if promo.is_scoped:
        return promo.calculate_scoped_discount(non_sale_lines).quantize(Decimal("0.01"))
    subtotal = sum((subtotal for _, subtotal in non_sale_lines), Decimal("0"))
    return promo.calculate_discount(subtotal).quantize(Decimal("0.01"))


def is_sale_product_line(product, variant=None, size_variant=None, currency="USD") -> bool:
    if not product:
        return False
    if getattr(product, "is_sale", False):
        return True
    if size_variant:
        currency = (currency or "USD").upper()
        regular = None
        sale = None
        if currency == "GEL":
            regular = size_variant.price_gel if size_variant.price_gel is not None else size_variant.price_usd
            sale = size_variant.sale_price_gel
        else:
            regular = size_variant.price_usd
            sale = size_variant.sale_price_usd
        return sale is not None and Decimal(sale) < Decimal(regular)
    return False


def calculate_earned_points(order_total_amount: Decimal) -> int:
    """1 paid currency unit earns 0.5 points, rounded to nearest integer."""
    raw_points = Decimal(order_total_amount) * POINTS_PER_CURRENCY_UNIT
    return int(raw_points.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def points_for_purchase(amount: Decimal) -> int:
    return calculate_earned_points(amount)


def format_percent(value: Decimal) -> str:
    value = Decimal(value or 0)
    if value == value.to_integral():
        return str(int(value))
    return str(value.quantize(Decimal("0.01")).normalize())


def _request_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _generate_points_voucher_code(user_id: int) -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(8))
    safe_user = "".join(ch for ch in str(user_id).upper() if ch in alphabet)
    return f"PTS{safe_user}{suffix}"[:50]


def _create_points_market_voucher(user, item: PointsMarketItem):
    if item.item_type != PointsMarketItem.TYPE_DIGITAL:
        return None
    from apps.promo.models import PromoCode, UserPromoGrant

    discount_value = item.voucher_discount_value or Decimal("0")
    if discount_value <= 0:
        raise ValueError("This voucher reward is missing a discount value.")

    for _ in range(8):
        code = _generate_points_voucher_code(user.id)
        if not PromoCode.objects.filter(code=code).exists():
            break
    else:
        raise ValueError("Could not generate a unique voucher code. Please try again.")

    promo = PromoCode.objects.create(
        code=code,
        discount_type=item.voucher_discount_type,
        discount_value=discount_value,
        max_uses=1,
        max_uses_per_user=1,
        min_order_value=item.voucher_min_order_value or Decimal("0"),
        is_active=True,
    )
    UserPromoGrant.objects.create(
        user=user,
        promo=promo,
        source=f"points_market:{item.id}",
    )
    return promo


def _profile_payload(user) -> dict:
    tier_balance = user.spendable_points
    tier = get_tier_for_points(tier_balance)
    next_threshold = tier.next_threshold
    progress = 100 if next_threshold is None else max(0, min(100, int((tier_balance / next_threshold) * 100)))
    pending_points = (
        PointTransaction.objects.filter(
            user=user,
            transaction_type=PointTransaction.TYPE_EARNED,
            status=PointTransaction.STATUS_PENDING,
        )
        .aggregate(total=Sum("points"))
        .get("total")
        or 0
    )
    return {
        "spendable_points": user.spendable_points,
        "lifetime_points": user.lifetime_points,
        "pending_points": pending_points,
        "tier": {
            "key": tier.key,
            "label": tier.label,
            "discount_percent": str(tier.discount_percent),
            "sale_bonus_percent": str(tier.discount_percent),
            "threshold": tier.threshold,
            "next_key": tier.next_key,
            "next_label": tier.next_label,
            "next_threshold": next_threshold,
            "next_sale_bonus_percent": str(TIER_SALE_BONUS_PERCENTS.get(tier.next_key, tier.discount_percent)) if tier.next_key else None,
            "points_to_next": max(0, (next_threshold or tier_balance) - tier_balance),
            "progress_percent": progress,
            "point_balance": tier_balance,
        },
    }


def _transaction_payload(transaction: PointTransaction) -> dict:
    return {
        "id": transaction.id,
        "transaction_type": transaction.transaction_type,
        "status": transaction.status,
        "points": transaction.points,
        "description": transaction.description,
        "available_at": transaction.available_at.isoformat() if transaction.available_at else None,
        "order_number": transaction.order.order_number if transaction.order_id else None,
        "market_item_name": transaction.market_item.name if transaction.market_item_id else None,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
    }


def _redemption_payload(redemption: PointsMarketRedemption) -> dict:
    return {
        "id": redemption.id,
        "status": redemption.status,
        "item_name": redemption.item_name,
        "point_cost": redemption.point_cost,
        "shipping_label": redemption.shipping_label,
        "shipping_price": str(redemption.shipping_price),
        "shipping_currency": redemption.shipping_currency,
        "tracking_code": redemption.tracking_code,
        "created_at": redemption.created_at.isoformat() if redemption.created_at else None,
    }


def _shipping_session_payload(session: PointsMarketShippingPaymentSession) -> dict:
    return {
        "token": str(session.token),
        "status": session.status,
        "item_name": session.item_name,
        "item_image_url": session.item_image_url,
        "point_cost": session.point_cost,
        "shipping_label": session.shipping_label,
        "shipping_price": str(session.shipping_price),
        "shipping_currency": session.shipping_currency,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
    }


def _address_snapshot(user, address_id=None, address_data=None) -> dict:
    from apps.users.models import Address

    if address_id:
        address = Address.objects.get(pk=address_id, user=user)
        return {
            "shipping_name": user.name or user.email,
            "shipping_line1": address.line1,
            "shipping_line2": address.line2,
            "shipping_city": address.city,
            "shipping_state": address.state,
            "shipping_zip": address.zip_code,
            "shipping_country": address.country,
            "shipping_email": user.email,
            "shipping_phone": user.phone or "",
        }

    data = address_data or {}
    required = ["line1", "city", "state", "zip_code", "country"]
    missing = [field for field in required if not str(data.get(field, "")).strip()]
    if missing:
        raise ValueError("Please complete the shipping address before redeeming this reward.")

    if data.get("save_address"):
        Address.objects.create(
            user=user,
            label=str(data.get("label") or "Points reward"),
            line1=str(data.get("line1")).strip(),
            line2=str(data.get("line2") or "").strip(),
            city=str(data.get("city")).strip(),
            state=str(data.get("state")).strip(),
            zip_code=str(data.get("zip_code")).strip(),
            country=str(data.get("country")).strip(),
            is_default=not Address.objects.filter(user=user).exists(),
        )

    return {
        "shipping_name": user.name or user.email,
        "shipping_line1": str(data.get("line1")).strip(),
        "shipping_line2": str(data.get("line2") or "").strip(),
        "shipping_city": str(data.get("city")).strip(),
        "shipping_state": str(data.get("state")).strip(),
        "shipping_zip": str(data.get("zip_code")).strip(),
        "shipping_country": str(data.get("country")).strip(),
        "shipping_email": user.email,
        "shipping_phone": user.phone or str(data.get("phone") or "").strip(),
    }


def _vendor_allows_self_pickup(vendor) -> bool:
    if not vendor:
        return False
    return not (
        vendor.slug in ("sculpi", "figure-studio")
        or vendor.catalog_category_slug == "figures"
        or getattr(vendor.user, "email", "") == "vendor2@kolekcia.com"
    )


def _shipping_snapshot(shipping_slug: str, country: str, vendor=None) -> dict:
    from apps.orders.models import DeliveryOption, VendorShippingOption

    country = (country or "").upper()
    market = "GE" if country == "GE" else "OTHER"
    currency = "GEL" if country == "GE" else "USD"
    if shipping_slug == "pickup":
        if vendor is not None and not _vendor_allows_self_pickup(vendor):
            raise ValueError("Self-pickup is not available for this vendor.")
        return {
            "shipping_type": "self-pickup",
            "shipping_label": "I will take it myself",
            "shipping_price": Decimal("0"),
            "shipping_currency": currency,
        }

    if vendor is not None:
        if not shipping_slug.startswith("vendor-"):
            raise ValueError("Please choose a valid shipping option.")
        try:
            option_id = int(shipping_slug.replace("vendor-", "", 1))
        except (TypeError, ValueError):
            raise ValueError("Please choose a valid shipping option.")
        option = VendorShippingOption.objects.get(pk=option_id, vendor=vendor, market=market, is_active=True)
        return {
            "shipping_type": f"vendor-{option.pk}",
            "shipping_label": option.label,
            "shipping_price": Decimal(option.price),
            "shipping_currency": currency,
        }

    if not shipping_slug.startswith("delivery-"):
        raise ValueError("Please choose a valid shipping option.")
    try:
        option_id = int(shipping_slug.replace("delivery-", "", 1))
    except (TypeError, ValueError):
        raise ValueError("Please choose a valid shipping option.")

    option = DeliveryOption.objects.get(pk=option_id, is_active=True)
    price = Decimal(option.price_gel if currency == "GEL" else option.price_usd)
    return {
        "shipping_type": f"delivery-{option.pk}",
        "shipping_label": option.label,
        "shipping_price": price,
        "shipping_currency": currency,
    }


@transaction.atomic
def create_pending_purchase_points(order) -> PointTransaction | None:
    if not order.user_id:
        return None
    # order.total is the final paid amount after tier/voucher discounts and shipping.
    points = calculate_earned_points(order.total)
    if points <= 0:
        return None
    user = type(order.user).objects.select_for_update().get(pk=order.user_id)
    user.lifetime_points = F("lifetime_points") + points
    user.save(update_fields=["lifetime_points"])
    return PointTransaction.objects.create(
        user=user,
        order=order,
        transaction_type=PointTransaction.TYPE_EARNED,
        status=PointTransaction.STATUS_PENDING,
        points=points,
        available_at=None,
        description=f"Pending loyalty points for order {order.order_number} until shipment",
        metadata={"order_total": str(order.total), "currency": order.currency, "unlock_condition": "order_shipped"},
    )


@transaction.atomic
def release_available_points(now=None) -> int:
    now = now or timezone.now()
    pending = list(
        PointTransaction.objects.select_for_update()
        .select_related("user")
        .filter(
            transaction_type=PointTransaction.TYPE_EARNED,
            status=PointTransaction.STATUS_PENDING,
            available_at__lte=now,
        )
        .order_by("created_at")
    )
    released = 0
    for tx in pending:
        user = type(tx.user).objects.select_for_update().get(pk=tx.user_id)
        tx.status = PointTransaction.STATUS_AVAILABLE
        tx.save(update_fields=["status"])
        user.spendable_points = F("spendable_points") + tx.points
        user.save(update_fields=["spendable_points"])
        released += 1
    return released


@transaction.atomic
def release_order_points_on_shipment(order) -> int:
    """Make earned order points spendable when the order ships.

    Returns the number of points released. Safe to call repeatedly; only pending
    earned rows are processed.
    """
    if not order.user_id:
        return 0
    pending = list(
        PointTransaction.objects.select_for_update()
        .filter(
            order=order,
            transaction_type=PointTransaction.TYPE_EARNED,
            status=PointTransaction.STATUS_PENDING,
        )
        .order_by("created_at")
    )
    if not pending:
        return 0

    user = type(order.user).objects.select_for_update().get(pk=order.user_id)
    released_points = sum(tx.points for tx in pending)
    now = timezone.now()
    for tx in pending:
        tx.status = PointTransaction.STATUS_AVAILABLE
        tx.available_at = now
        tx.description = f"Loyalty points unlocked when order {order.order_number} shipped"
        tx.metadata = {**(tx.metadata or {}), "released_on": "order_shipped"}
        tx.save(update_fields=["status", "available_at", "description", "metadata"])
    user.spendable_points = F("spendable_points") + released_points
    user.save(update_fields=["spendable_points"])
    return released_points


@transaction.atomic
def purchase_market_item(user, item_id: int) -> PointTransaction:
    User = get_user_model()
    locked_user = User.objects.select_for_update().get(id=user.id)
    item = PointsMarketItem.objects.select_for_update().get(pk=item_id)

    if item.item_type == PointsMarketItem.TYPE_PHYSICAL:
        raise ValueError("Physical rewards require address and shipping selection.")
    if not item.is_active or item.stock_quantity <= 0:
        raise ValueError("This reward is no longer available.")
    if locked_user.spendable_points < item.point_cost:
        raise ValueError("You do not have enough spendable points for this reward.")

    locked_user.spendable_points = F("spendable_points") - item.point_cost
    locked_user.save(update_fields=["spendable_points"])

    item.stock_quantity = F("stock_quantity") - 1
    item.save(update_fields=["stock_quantity"])
    item.refresh_from_db(fields=["stock_quantity", "is_active"])
    if item.stock_quantity <= 0:
        item.is_active = False
        item.locked_at = timezone.now()
        item.save(update_fields=["is_active", "locked_at"])

    return PointTransaction.objects.create(
        user=locked_user,
        market_item=item,
        transaction_type=PointTransaction.TYPE_SPENT,
        status=PointTransaction.STATUS_SPENT,
        points=-item.point_cost,
        description=f"Points market purchase: {item.name}",
        metadata={"item_type": item.item_type},
    )


@transaction.atomic
def purchase_market_item_idempotent(user, item_id: int, idempotency_key) -> PointsMarketPurchaseResult:
    payload_hash = _request_hash({"item_id": item_id})
    idem, created = IdempotencyKey.objects.get_or_create(
        user_id=user.id,
        scope="points_market_purchase",
        key=idempotency_key,
        defaults={"request_hash": payload_hash},
    )
    idem = IdempotencyKey.objects.select_for_update().get(pk=idem.pk)

    if not created:
        if idem.request_hash != payload_hash:
            raise ValueError("This idempotency key was already used with different purchase details.")
        if idem.status == IdempotencyKey.STATUS_SUCCEEDED and idem.response_data:
            return PointsMarketPurchaseResult(response_data=idem.response_data, replayed=True)

    User = get_user_model()
    locked_user = User.objects.select_for_update().get(id=user.id)
    item = PointsMarketItem.objects.select_for_update().get(id=item_id)

    if item.item_type == PointsMarketItem.TYPE_PHYSICAL:
        idem.status = IdempotencyKey.STATUS_FAILED
        idem.save(update_fields=["status"])
        raise ValueError("Physical rewards require address and shipping selection.")
    if not item.is_active or item.stock_quantity <= 0:
        idem.status = IdempotencyKey.STATUS_FAILED
        idem.save(update_fields=["status"])
        raise ValueError("This reward is no longer available.")
    if locked_user.spendable_points < item.point_cost:
        idem.status = IdempotencyKey.STATUS_FAILED
        idem.save(update_fields=["status"])
        raise ValueError("You do not have enough spendable points for this reward.")

    locked_user.spendable_points = F("spendable_points") - item.point_cost
    locked_user.save(update_fields=["spendable_points"])
    locked_user.refresh_from_db(fields=["spendable_points", "lifetime_points"])

    item.stock_quantity = F("stock_quantity") - 1
    item.save(update_fields=["stock_quantity"])
    item.refresh_from_db(fields=["stock_quantity", "is_active"])
    if item.stock_quantity <= 0:
        item.is_active = False
        item.locked_at = timezone.now()
        item.save(update_fields=["is_active", "locked_at"])

    transaction_obj = PointTransaction.objects.create(
        user=locked_user,
        market_item=item,
        transaction_type=PointTransaction.TYPE_SPENT,
        status=PointTransaction.STATUS_SPENT,
        points=-item.point_cost,
        description=f"Points market purchase: {item.name}",
        metadata={"item_type": item.item_type, "idempotency_key": str(idempotency_key)},
    )
    voucher = _create_points_market_voucher(locked_user, item)
    if voucher:
        transaction_obj.metadata = {
            **(transaction_obj.metadata or {}),
            "voucher_code": voucher.code,
            "voucher_discount_type": voucher.discount_type,
            "voucher_discount_value": str(voucher.discount_value),
            "voucher_max_uses": voucher.max_uses,
        }
        transaction_obj.save(update_fields=["metadata"])
    response_data = {
        "transaction": _transaction_payload(transaction_obj),
        "profile": _profile_payload(locked_user),
        "voucher": {
            "code": voucher.code,
            "discount_type": voucher.discount_type,
            "discount_value": str(voucher.discount_value),
            "max_uses": voucher.max_uses,
            "max_uses_per_user": voucher.max_uses_per_user,
        } if voucher else None,
    }
    idem.status = IdempotencyKey.STATUS_SUCCEEDED
    idem.transaction = transaction_obj
    idem.response_data = response_data
    idem.save(update_fields=["status", "transaction", "response_data"])
    return PointsMarketPurchaseResult(response_data=response_data, replayed=False)


def _finalize_physical_redemption(
    *,
    locked_user,
    item: PointsMarketItem,
    address_snapshot: dict,
    shipping_snapshot: dict,
    idempotency_key: str,
    description_prefix: str = "Points market physical redemption",
) -> tuple[PointTransaction, PointsMarketRedemption]:
    if item.item_type != PointsMarketItem.TYPE_PHYSICAL:
        raise ValueError("Only physical rewards can be redeemed through this flow.")
    if not item.is_active or item.stock_quantity <= 0:
        raise ValueError("This reward is no longer available.")
    if locked_user.spendable_points < item.point_cost:
        raise ValueError("You do not have enough spendable points for this reward.")

    locked_user.spendable_points = F("spendable_points") - item.point_cost
    locked_user.save(update_fields=["spendable_points"])
    locked_user.refresh_from_db(fields=["spendable_points", "lifetime_points"])

    item.stock_quantity = F("stock_quantity") - 1
    item.save(update_fields=["stock_quantity"])
    item.refresh_from_db(fields=["stock_quantity", "is_active"])
    if item.stock_quantity <= 0:
        item.is_active = False
        item.locked_at = timezone.now()
        item.save(update_fields=["is_active", "locked_at"])

    transaction_obj = PointTransaction.objects.create(
        user=locked_user,
        market_item=item,
        transaction_type=PointTransaction.TYPE_SPENT,
        status=PointTransaction.STATUS_SPENT,
        points=-item.point_cost,
        description=f"{description_prefix}: {item.name}",
        metadata={
            "item_type": item.item_type,
            "idempotency_key": idempotency_key,
            "shipping_type": shipping_snapshot["shipping_type"],
            "shipping_label": shipping_snapshot["shipping_label"],
            "shipping_price": str(shipping_snapshot["shipping_price"]),
            "shipping_currency": shipping_snapshot["shipping_currency"],
        },
    )
    image_urls = item.image_urls or []
    redemption = PointsMarketRedemption.objects.create(
        user=locked_user,
        market_item=item,
        transaction=transaction_obj,
        item_name=item.name,
        item_image_url=item.main_image_url or (image_urls[0] if image_urls else ""),
        point_cost=item.point_cost,
        **address_snapshot,
        **shipping_snapshot,
    )
    return transaction_obj, redemption


@transaction.atomic
def redeem_physical_market_item_idempotent(
    user,
    item_id: int,
    idempotency_key,
    *,
    shipping_slug: str,
    address_id=None,
    address_data=None,
    country: str = "",
) -> PointsMarketPurchaseResult:
    payload_hash = _request_hash({
        "item_id": item_id,
        "shipping_slug": shipping_slug,
        "address_id": address_id,
        "address_data": address_data or {},
        "country": country,
    })
    idem, created = IdempotencyKey.objects.get_or_create(
        user_id=user.id,
        scope="points_market_redemption",
        key=idempotency_key,
        defaults={"request_hash": payload_hash},
    )
    idem = IdempotencyKey.objects.select_for_update().get(pk=idem.pk)

    if not created:
        if idem.request_hash != payload_hash:
            raise ValueError("This idempotency key was already used with different redemption details.")
        if idem.status == IdempotencyKey.STATUS_SUCCEEDED and idem.response_data:
            return PointsMarketPurchaseResult(response_data=idem.response_data, replayed=True)

    User = get_user_model()
    locked_user = User.objects.select_for_update().get(id=user.id)
    item = PointsMarketItem.objects.select_for_update().get(id=item_id)

    if item.item_type != PointsMarketItem.TYPE_PHYSICAL:
        idem.status = IdempotencyKey.STATUS_FAILED
        idem.save(update_fields=["status"])
        raise ValueError("Use the voucher purchase flow for digital rewards.")
    if not item.is_active or item.stock_quantity <= 0:
        idem.status = IdempotencyKey.STATUS_FAILED
        idem.save(update_fields=["status"])
        raise ValueError("This reward is no longer available.")
    if locked_user.spendable_points < item.point_cost:
        idem.status = IdempotencyKey.STATUS_FAILED
        idem.save(update_fields=["status"])
        raise ValueError("You do not have enough spendable points for this reward.")

    address_snapshot = _address_snapshot(locked_user, address_id=address_id, address_data=address_data)
    shipping_snapshot = _shipping_snapshot(shipping_slug, country or address_snapshot["shipping_country"], vendor=item.vendor)
    if shipping_snapshot["shipping_price"] > 0:
        image_urls = item.image_urls or []
        session = PointsMarketShippingPaymentSession.objects.create(
            token=uuid.uuid4(),
            user=locked_user,
            market_item=item,
            item_name=item.name,
            item_image_url=item.main_image_url or (image_urls[0] if image_urls else ""),
            point_cost=item.point_cost,
            expires_at=timezone.now() + timezone.timedelta(hours=2),
            **address_snapshot,
            **shipping_snapshot,
        )
        response_data = {
            "payment_required": True,
            "detail": "Complete shipping payment to redeem this reward.",
            "shipping_payment_session": _shipping_session_payload(session),
            "shipping": {
                **shipping_snapshot,
                "shipping_price": str(shipping_snapshot["shipping_price"]),
            },
            "profile": _profile_payload(locked_user),
        }
        idem.status = IdempotencyKey.STATUS_SUCCEEDED
        idem.response_data = response_data
        idem.save(update_fields=["status", "response_data"])
        return PointsMarketPurchaseResult(response_data=response_data, replayed=False)

    transaction_obj, redemption = _finalize_physical_redemption(
        locked_user=locked_user,
        item=item,
        address_snapshot=address_snapshot,
        shipping_snapshot=shipping_snapshot,
        idempotency_key=str(idempotency_key),
    )
    response_data = {
        "transaction": _transaction_payload(transaction_obj),
        "redemption": _redemption_payload(redemption),
        "profile": _profile_payload(locked_user),
        "voucher": None,
    }
    idem.status = IdempotencyKey.STATUS_SUCCEEDED
    idem.transaction = transaction_obj
    idem.response_data = response_data
    idem.save(update_fields=["status", "transaction", "response_data"])
    return PointsMarketPurchaseResult(response_data=response_data, replayed=False)


@transaction.atomic
def complete_shipping_payment_session(user, token) -> dict:
    User = get_user_model()
    locked_user = User.objects.select_for_update().get(id=user.id)
    session = (
        PointsMarketShippingPaymentSession.objects.select_for_update()
        .select_related("market_item")
        .get(token=token, user=locked_user)
    )

    if session.status == PointsMarketShippingPaymentSession.STATUS_PAID and session.redemption_id:
        return {
            "payment_session": _shipping_session_payload(session),
            "redemption": _redemption_payload(session.redemption),
            "profile": _profile_payload(locked_user),
        }
    if session.status != PointsMarketShippingPaymentSession.STATUS_PENDING:
        raise ValueError("This shipping payment session is not payable.")
    if session.expires_at <= timezone.now():
        session.status = PointsMarketShippingPaymentSession.STATUS_EXPIRED
        session.save(update_fields=["status", "updated_at"])
        raise ValueError("This shipping payment session has expired. Please start again.")
    if not session.market_item_id:
        raise ValueError("This reward is no longer available.")

    item = PointsMarketItem.objects.select_for_update().get(pk=session.market_item_id)
    address_snapshot = {
        "shipping_name": session.shipping_name,
        "shipping_line1": session.shipping_line1,
        "shipping_line2": session.shipping_line2,
        "shipping_city": session.shipping_city,
        "shipping_state": session.shipping_state,
        "shipping_zip": session.shipping_zip,
        "shipping_country": session.shipping_country,
        "shipping_email": session.shipping_email,
        "shipping_phone": session.shipping_phone,
    }
    shipping_snapshot = {
        "shipping_type": session.shipping_type,
        "shipping_label": session.shipping_label,
        "shipping_price": session.shipping_price,
        "shipping_currency": session.shipping_currency,
    }
    transaction_obj, redemption = _finalize_physical_redemption(
        locked_user=locked_user,
        item=item,
        address_snapshot=address_snapshot,
        shipping_snapshot=shipping_snapshot,
        idempotency_key=f"shipping-session:{session.token}",
        description_prefix="Points market paid-shipping redemption",
    )
    session.status = PointsMarketShippingPaymentSession.STATUS_PAID
    session.paid_at = timezone.now()
    session.redemption = redemption
    session.save(update_fields=["status", "paid_at", "redemption", "updated_at"])
    return {
        "transaction": _transaction_payload(transaction_obj),
        "redemption": _redemption_payload(redemption),
        "payment_session": _shipping_session_payload(session),
        "profile": _profile_payload(locked_user),
    }


@transaction.atomic
def reverse_order_points_for_refund(order, reason: str = "Order refund") -> PointTransaction | None:
    if not order.user_id:
        return None

    original = (
        PointTransaction.objects.select_for_update()
        .filter(
            order=order,
            transaction_type=PointTransaction.TYPE_EARNED,
        )
        .exclude(status=PointTransaction.STATUS_CANCELLED)
        .order_by("created_at")
        .first()
    )
    if not original:
        return None

    User = get_user_model()
    user = User.objects.select_for_update().get(id=order.user_id)
    points_to_reverse = abs(original.points)

    user.spendable_points = F("spendable_points") - points_to_reverse
    user.lifetime_points = F("lifetime_points") - points_to_reverse
    user.save(update_fields=["spendable_points", "lifetime_points"])

    original.status = PointTransaction.STATUS_CANCELLED
    original.save(update_fields=["status"])

    return PointTransaction.objects.create(
        user=user,
        order=order,
        transaction_type=PointTransaction.TYPE_REFUND_REVERSAL,
        status=PointTransaction.STATUS_CANCELLED,
        points=-points_to_reverse,
        description=reason,
        metadata={"reversed_transaction_id": original.id, "order_total": str(order.total), "currency": order.currency},
    )


class CheckoutDiscountCalculator:
    def __init__(
        self,
        user,
        discount_base: Decimal,
        promo=None,
        voucher_discount: Decimal | None = None,
        tier_eligible_subtotal: Decimal | None = None,
        tier_info: TierInfo | None = None,
    ):
        self.user = user
        self.discount_base = Decimal(discount_base or 0)
        self.promo = promo
        self.voucher_discount = Decimal(voucher_discount or 0)
        self.tier_eligible_subtotal = Decimal(tier_eligible_subtotal or 0)
        self.tier_info = tier_info

    def evaluate(self) -> DiscountDecision:
        tier = self.tier_info or get_tier_for_points(getattr(self.user, "spendable_points", 0) or 0)
        tier_discount = (self.tier_eligible_subtotal * tier.discount_percent / Decimal("100")).quantize(Decimal("0.01"))
        voucher_percent = None
        if self.promo and getattr(self.promo, "discount_type", "") == "percent":
            voucher_percent = Decimal(self.promo.discount_value)

        if self.voucher_discount > 0 and tier_discount > 0:
            return DiscountDecision(
                discount=(self.voucher_discount + tier_discount).quantize(Decimal("0.01")),
                source="tier_voucher",
                tier_discount=tier_discount,
                voucher_discount=self.voucher_discount,
                tier_percent=tier.discount_percent,
                voucher_percent=voucher_percent,
                ignored_source="",
                message="Tier bonus was applied to sale products. Voucher discount was applied only to non-sale products.",
            )
        if self.voucher_discount > 0:
            return DiscountDecision(
                discount=self.voucher_discount,
                source="voucher",
                tier_discount=tier_discount,
                voucher_discount=self.voucher_discount,
                tier_percent=tier.discount_percent,
                voucher_percent=voucher_percent,
                ignored_source="",
                message="Voucher discount is applied only to non-sale products.",
            )
        if tier_discount > Decimal("0"):
            return DiscountDecision(
                discount=tier_discount,
                source="tier",
                tier_discount=tier_discount,
                voucher_discount=self.voucher_discount,
                tier_percent=tier.discount_percent,
                voucher_percent=voucher_percent,
                ignored_source="",
                message=f"Your {tier.label} +{format_percent(tier.discount_percent)}% tier bonus is applied only to sale products.",
            )
        return DiscountDecision(
            discount=Decimal("0"),
            source="none",
            tier_discount=Decimal("0"),
            voucher_discount=self.voucher_discount,
            tier_percent=tier.discount_percent,
            voucher_percent=voucher_percent,
            ignored_source="",
            message="No eligible sale-product tier bonus or non-sale voucher discount is available.",
        )
