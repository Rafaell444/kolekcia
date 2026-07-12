from apps.products.models import CatalogFilterConfig, DEFAULT_VISIBLE_FILTERS
from apps.vendors.models import Vendor


def _normalize_category(category: str) -> str:
    c = (category or "").strip().lower()
    if c in {"figures", "figure"}:
        return "figures"
    if c in {"wallpanels", "wallpanel", "panels", "panel"}:
        return "wallpanels"
    return c


def _apply_config(merged: dict, cfg: CatalogFilterConfig | None) -> dict:
    if not cfg or not isinstance(cfg.visible_filters, dict):
        return merged
    for key in merged:
        if key in cfg.visible_filters:
            merged[key] = bool(cfg.visible_filters[key])
    return merged


def resolve_catalog_filter_visibility(category: str = "") -> dict:
    merged = dict(DEFAULT_VISIBLE_FILTERS)
    category_slug = _normalize_category(category)

    global_cfg = CatalogFilterConfig.objects.filter(scope="global", vendor__isnull=True).first()
    merged = _apply_config(merged, global_cfg)

    if category_slug:
        cat_cfg = CatalogFilterConfig.objects.filter(
            scope="category", category_slug=category_slug, vendor__isnull=True
        ).first()
        merged = _apply_config(merged, cat_cfg)

        vendor = Vendor.objects.filter(catalog_category_slug=category_slug).first()
        if vendor:
            vendor_cfg = CatalogFilterConfig.objects.filter(scope="vendor", vendor=vendor).first()
            merged = _apply_config(merged, vendor_cfg)

    return merged
