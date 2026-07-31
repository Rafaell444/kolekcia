import django_filters
from .models import Product


class ProductFilter(django_filters.FilterSet):
    category   = django_filters.CharFilter(method="filter_category")
    artist     = django_filters.CharFilter(method="filter_artist")
    vendor     = django_filters.CharFilter(method="filter_vendor")
    min_price  = django_filters.NumberFilter(method="filter_price_range")
    max_price  = django_filters.NumberFilter(method="filter_price_range")
    sale       = django_filters.BooleanFilter(field_name="is_sale")
    new        = django_filters.BooleanFilter(field_name="is_new")
    exclusive  = django_filters.BooleanFilter(field_name="is_exclusive")
    limited    = django_filters.BooleanFilter(field_name="is_limited")
    material   = django_filters.CharFilter(method="filter_material")
    size       = django_filters.CharFilter(method="filter_size")
    tag        = django_filters.CharFilter(method="filter_tag")

    class Meta:
        model = Product
        fields = ["category", "artist", "vendor", "min_price", "max_price", "sale", "new", "exclusive", "limited", "material", "size", "tag"]

    def filter_category(self, queryset, name, value):
        from django.db.models import Q
        normalized = (value or "").strip().lower()
        if normalized in {"figures", "figure"}:
            slug = "figures"
        elif normalized in {"wallpanels", "wallpanel", "panels", "panel"}:
            slug = "wallpanels"
        else:
            slug = normalized
        if not slug:
            return queryset
        return queryset.filter(
            Q(category__slug__iexact=slug) | Q(categories__slug__iexact=slug)
        ).distinct()

    def filter_artist(self, queryset, name, value):
        # Accept comma-separated list of artist handles
        handles = [h.strip().lower() for h in (value or "").split(",") if h.strip()]
        if not handles:
            return queryset
        return queryset.filter(artist__handle__in=handles)

    def filter_vendor(self, queryset, name, value):
        slug = (value or "").strip()
        if not slug:
            return queryset
        return queryset.filter(vendor__slug__iexact=slug)

    def filter_price_range(self, queryset, name, value):
        # Apply both limits once so one active variant must satisfy the full range.
        if name == "max_price" and self.data.get("min_price") not in (None, ""):
            return queryset

        from django.db.models import Exists, OuterRef, Q
        from .models import SizeVariant

        try:
            minimum = float(self.data.get("min_price")) if self.data.get("min_price") not in (None, "") else None
            maximum = float(self.data.get("max_price")) if self.data.get("max_price") not in (None, "") else None
        except (TypeError, ValueError):
            return queryset

        currency = str(self.data.get("currency", "USD")).upper()
        if currency not in {"USD", "GEL", "EUR", "GBP"}:
            currency = "USD"
        price_field = f"price_{currency.lower()}"

        active_variants = SizeVariant.objects.filter(product_id=OuterRef("pk"), is_active=True)
        matching_variants = active_variants
        if minimum is not None:
            if currency == "USD":
                matching_variants = matching_variants.filter(price_usd__gte=minimum)
            else:
                matching_variants = matching_variants.filter(
                    Q(**{f"{price_field}__gte": minimum}) |
                    Q(**{f"{price_field}__isnull": True, "price_usd__gte": minimum})
                )
        if maximum is not None:
            if currency == "USD":
                matching_variants = matching_variants.filter(price_usd__lte=maximum)
            else:
                matching_variants = matching_variants.filter(
                    Q(**{f"{price_field}__lte": maximum}) |
                    Q(**{f"{price_field}__isnull": True, "price_usd__lte": maximum})
                )

        base_filters = Q()
        if minimum is not None:
            base_filters &= Q(base_price__gte=minimum)
        if maximum is not None:
            base_filters &= Q(base_price__lte=maximum)

        return queryset.annotate(
            _has_active_size_variants=Exists(active_variants),
            _has_matching_size_variant=Exists(matching_variants),
        ).filter(
            Q(_has_active_size_variants=True, _has_matching_size_variant=True) |
            Q(_has_active_size_variants=False) & base_filters
        )

    def filter_material(self, queryset, name, value):
        materials = [m.strip() for m in (value or "").split(",") if m.strip()]
        if not materials:
            return queryset
        from django.db.models import Q
        q = Q()
        for m in materials:
            q |= Q(material__icontains=m)
        return queryset.filter(q)

    def filter_size(self, queryset, name, value):
        sizes = [s.strip() for s in (value or "").split(",") if s.strip()]
        if not sizes:
            return queryset
        from django.db.models import Q
        q = Q()
        for s in sizes:
            q |= Q(size_variants__label__iexact=s)
        return queryset.filter(q).distinct()

    def filter_tag(self, queryset, name, value):
        # Accept comma-separated tag values; products must contain ANY of the given tags
        tags = [t.strip() for t in (value or "").split(",") if t.strip()]
        if not tags:
            return queryset
        from django.db.models import Q
        q = Q()
        for t in tags:
            # tags__contains=[t] checks if the JSON array contains exactly this element
            q |= Q(tags__contains=[t])
        return queryset.filter(q)
