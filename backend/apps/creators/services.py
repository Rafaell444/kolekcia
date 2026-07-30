import urllib.request
import json
from datetime import date as date_type
from decimal import Decimal

from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction

from apps.cms.models import SiteSettings


DEFAULT_PAYOUT_MINIMUM_GEL = Decimal("200.00")


def get_payout_minimum_gel() -> Decimal:
    row = SiteSettings.objects.filter(key="creator_payout_minimum_gel").first()
    if row and row.value:
        try:
            return Decimal(str(row.value)).quantize(Decimal("0.01"))
        except Exception:
            pass
    return DEFAULT_PAYOUT_MINIMUM_GEL


def set_payout_minimum_gel(value: Decimal | str | int | float) -> Decimal:
    amount = Decimal(str(value)).quantize(Decimal("0.01"))
    SiteSettings.objects.update_or_create(
        key="creator_payout_minimum_gel",
        defaults={"value": str(amount)},
    )
    return amount


def product_subtotal_from_cart(cart) -> Decimal:
    """Product prices only — excludes gift wrap and processing fees."""
    from apps.orders.pricing import resolve_unit_price

    total = Decimal("0")
    for item in cart.items.select_related("variant", "size_variant").all():
        unit = Decimal(item.unit_price or 0)
        if unit == 0:
            unit = resolve_unit_price(item.variant, item.size_variant, item.currency)
        total += unit * item.quantity
    return total.quantize(Decimal("0.01"))


def product_subtotal_from_order(order) -> Decimal:
    """Sum of order item unit_price * qty (products only)."""
    total = Decimal("0")
    for item in order.items.all():
        total += Decimal(item.price) * item.quantity
    return total.quantize(Decimal("0.01"))


def notify_admins(subject: str, body: str) -> None:
    recipients = []
    support = SiteSettings.objects.filter(key="support_email").first()
    if support and support.value:
        recipients.append(support.value.strip())
    admin_box = getattr(settings, "EMAIL_HOST_USER", "") or ""
    if admin_box and admin_box not in recipients:
        recipients.append(admin_box)
    if not recipients:
        return
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, "EMAIL_FROM_ACCOUNTS", None)
            or settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=True,
        )
    except Exception:
        pass


def fetch_nbg_rate(from_currency: str, target_date: "date_type | None" = None) -> "Decimal | None":
    """
    Fetch the GEL exchange rate for `from_currency` from the National Bank of Georgia API.
    Results are cached in FxRate per date. Falls back to most recent cached rate if API fails.
    Returns the rate (1 USD = X GEL) or None if completely unavailable.
    """
    from apps.creators.models import FxRate
    from datetime import date as today_cls

    if target_date is None:
        target_date = today_cls.today()
    to_currency = "GEL"

    # Check cache first
    cached = FxRate.objects.filter(
        date=target_date, from_currency=from_currency, to_currency=to_currency
    ).first()
    if cached:
        return cached.rate

    # Fetch from NBG public API
    date_str = target_date.strftime("%Y-%m-%d")
    url = f"https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date={date_str}"
    rate = None
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        currencies = payload[0].get("currencies", []) if payload else []
        for entry in currencies:
            if entry.get("code", "").upper() == from_currency.upper():
                # NBG provides rate per `quantity` units
                quantity = Decimal(str(entry.get("quantity", 1) or 1))
                rate_raw = Decimal(str(entry.get("rate", 0) or 0))
                if rate_raw > 0:
                    rate = (rate_raw / quantity).quantize(Decimal("0.000001"))
                break
    except Exception:
        pass

    if rate and rate > 0:
        try:
            FxRate.objects.update_or_create(
                date=target_date,
                from_currency=from_currency,
                to_currency=to_currency,
                defaults={"rate": rate, "source": "NBG"},
            )
        except Exception:
            pass
        return rate

    # Fallback: most recent cached rate
    fallback = FxRate.objects.filter(
        from_currency=from_currency, to_currency=to_currency
    ).order_by("-date").first()
    return fallback.rate if fallback else None


def expected_creator_credit_for_order(order) -> Decimal:
    """What the creator would earn once this order is marked paid (processing)."""
    promo = order.promo_code
    if not promo or not promo.owner_id:
        return Decimal("0.00")
    if promo.discount_type != "percent":
        return Decimal("0.00")
    product_sub = product_subtotal_from_order(order)
    if product_sub <= 0:
        return Decimal("0.00")
    return (product_sub * Decimal(promo.discount_value) / Decimal("100")).quantize(Decimal("0.01"))


def list_voucher_redemptions(promo, limit: int = 50) -> list[dict]:
    """Orders that used a creator voucher, with credit status."""
    from apps.creators.models import CreatorLedgerEntry
    from apps.promo.models import PromoCodeUsage

    if not promo:
        return []

    usages = (
        PromoCodeUsage.objects.filter(promo=promo, order__isnull=False)
        .select_related("order", "user")
        .order_by("-used_at")[:limit]
    )
    rows = []
    for usage in usages:
        order = usage.order
        if not order:
            continue
        credited = CreatorLedgerEntry.objects.filter(
            order=order, entry_type=CreatorLedgerEntry.TYPE_CREDIT
        ).exists()
        expected = expected_creator_credit_for_order(order)
        rows.append({
            "usage_id": usage.id,
            "order_id": str(order.id),
            "order_number": order.order_number,
            "order_status": order.status,
            "buyer_email": (usage.user.email if usage.user_id else "") or order.shipping_email or "",
            "currency": order.currency or "GEL",
            "order_total": str(order.total),
            "order_discount": str(order.discount),
            "product_subtotal": str(product_subtotal_from_order(order)),
            "expected_credit": str(expected),
            "credited": credited,
            "used_at": usage.used_at.isoformat() if usage.used_at else None,
        })
    return rows


@transaction.atomic
def credit_creator_for_paid_order(order) -> bool:
    """
    When order becomes paid (status=processing), credit the promo owner
    with shared % of product subtotal. Idempotent per order.
    Georgian creators (country='GE') always receive GEL; if order currency
    is non-GEL, the amount is converted using the NBG daily rate and the
    FX details are stored in the ledger entry for a full audit trail.
    """
    from datetime import date as today_cls
    from apps.creators.models import ContentCreator, CreatorLedgerEntry
    promo = order.promo_code
    if not promo or not promo.owner_id:
        return False
    if promo.discount_type != "percent":
        return False
    try:
        creator = ContentCreator.objects.select_for_update().get(
            user_id=promo.owner_id, is_active=True, promo=promo
        )
    except ContentCreator.DoesNotExist:
        return False
    if CreatorLedgerEntry.objects.filter(order=order, entry_type=CreatorLedgerEntry.TYPE_CREDIT).exists():
        return False
    product_sub = product_subtotal_from_order(order)
    if product_sub <= 0:
        return False

    order_currency = (order.currency or "GEL").upper()
    amount_in_order_currency = (
        product_sub * Decimal(promo.discount_value) / Decimal("100")
    ).quantize(Decimal("0.01"))
    if amount_in_order_currency <= 0:
        return False

    buyer_email = ""
    if order.user_id:
        buyer_email = order.user.email
    elif order.shipping_email:
        buyer_email = order.shipping_email

    # FX conversion: Georgian creators always earn in GEL
    original_amount = None
    original_currency = ""
    fx_rate_used = None
    fx_date_used = None
    ledger_currency = order_currency
    ledger_amount = amount_in_order_currency

    if creator.country == "GE" and order_currency != "GEL":
        rate = fetch_nbg_rate(order_currency)
        if rate and rate > 0:
            gel_amount = (amount_in_order_currency * rate).quantize(Decimal("0.01"))
            original_amount = amount_in_order_currency
            original_currency = order_currency
            fx_rate_used = rate
            fx_date_used = today_cls.today()
            ledger_amount = gel_amount
            ledger_currency = "GEL"
        # If rate unavailable, fall back to crediting in order_currency

    CreatorLedgerEntry.objects.create(
        creator=creator,
        entry_type=CreatorLedgerEntry.TYPE_CREDIT,
        amount=ledger_amount,
        currency=ledger_currency,
        order=order,
        order_number=order.order_number,
        buyer_email=buyer_email,
        product_subtotal=product_sub,
        discount_percent=promo.discount_value,
        original_amount=original_amount,
        original_currency=original_currency,
        fx_rate=fx_rate_used,
        fx_date=fx_date_used,
        note=(
            f"Credit from order {order.order_number}"
            + (f" (converted {original_amount} {original_currency} → {ledger_amount} GEL @ {fx_rate_used})" if original_amount else "")
        ),
    )
    return True


@transaction.atomic
def clawback_creator_for_order(order) -> bool:
    """Reverse credit if order is cancelled after payment credit."""
    from apps.creators.models import CreatorLedgerEntry

    credit = (
        CreatorLedgerEntry.objects.select_for_update()
        .filter(order=order, entry_type=CreatorLedgerEntry.TYPE_CREDIT)
        .first()
    )
    if not credit:
        return False
    if CreatorLedgerEntry.objects.filter(
        order=order, entry_type=CreatorLedgerEntry.TYPE_CLAWBACK
    ).exists():
        return False

    CreatorLedgerEntry.objects.create(
        creator=credit.creator,
        entry_type=CreatorLedgerEntry.TYPE_CLAWBACK,
        amount=credit.amount,
        currency=credit.currency,
        order=order,
        order_number=order.order_number,
        buyer_email=credit.buyer_email,
        product_subtotal=credit.product_subtotal,
        discount_percent=credit.discount_percent,
        note=f"Clawback for cancelled order {order.order_number}",
    )
    return True
