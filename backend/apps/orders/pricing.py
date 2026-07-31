"""Market pricing helpers — use admin-written regional prices, never FX convert."""

from decimal import Decimal


def normalize_currency(currency: str | None) -> str:
    cur = (currency or "USD").upper().strip()
    return cur if cur in {"USD", "GEL", "EUR", "GBP"} else "USD"


def resolve_unit_price(variant, size_variant, currency="USD") -> Decimal:
    """
    Market unit price as written in admin — no FX conversion.
    GEL → price_gel (fallback price_usd if unset), USD → price_usd, etc.
    """
    currency = normalize_currency(currency)
    if size_variant:
        regular = None
        sale = None
        if currency == "GEL":
            regular = size_variant.price_gel if size_variant.price_gel is not None else size_variant.price_usd
            sale = size_variant.sale_price_gel
        elif currency == "EUR":
            regular = size_variant.price_eur if size_variant.price_eur is not None else size_variant.price_usd
        elif currency == "GBP":
            regular = size_variant.price_gbp if size_variant.price_gbp is not None else size_variant.price_usd
        else:
            regular = size_variant.price_usd
            sale = size_variant.sale_price_usd
        regular = Decimal(regular)
        if sale is not None and Decimal(sale) < regular:
            return Decimal(sale).quantize(Decimal("0.01"))
        return regular.quantize(Decimal("0.01"))
    if variant:
        return Decimal(variant.price).quantize(Decimal("0.01"))
    return Decimal("0.00")


def resolve_gift_wrap_price(variant, size_variant, currency="USD") -> Decimal:
    """Per-vendor gift wrap in the requested currency (no FX)."""
    currency = normalize_currency(currency)
    vendor = None
    if size_variant:
        vendor = getattr(size_variant.product, "vendor", None)
    elif variant:
        vendor = getattr(variant.product, "vendor", None)
    if vendor:
        return Decimal(vendor.gift_wrap_price_gel if currency == "GEL" else vendor.gift_wrap_price_usd)
    try:
        from apps.cms.models import SiteSettings
        setting = SiteSettings.objects.filter(key="gift_wrap_price").first()
        if setting and setting.value:
            return Decimal(str(setting.value))
    except Exception:
        pass
    return Decimal("0")


def resolve_processing(variant, size_variant, slug: str, currency="USD"):
    """
    Processing option fee + display fields (no FX).
    Returns (fee, label, days_text).
    """
    from apps.orders.models import ProcessingOption

    if not slug:
        return Decimal("0"), "", ""

    currency = normalize_currency(currency)
    vendor = None
    product = None
    if size_variant:
        product = size_variant.product
        vendor = getattr(product, "vendor", None)
    elif variant:
        product = variant.product
        vendor = getattr(product, "vendor", None)

    qs = ProcessingOption.objects.filter(slug=slug, is_active=True)
    if product is not None:
        qs = qs.filter(products=product)
    opt = None
    if vendor is not None:
        opt = qs.filter(vendor=vendor).first()
    if opt is None:
        opt = qs.filter(vendor__isnull=True).first()
    if opt is None:
        opt = qs.first()
    if opt is None:
        return Decimal("0"), slug.replace("-", " ").title(), ""

    if opt.is_included:
        fee = Decimal("0")
    else:
        fee = Decimal(opt.price_gel if currency == "GEL" else opt.price_usd)
    days = f"{opt.est_days_min}-{opt.est_days_max} days"
    return fee, opt.label, days
