import django_filters
from .models import Product


class ProductFilter(django_filters.FilterSet):
    category   = django_filters.CharFilter(method="filter_category")
    artist     = django_filters.CharFilter(method="filter_artist")
    min_price  = django_filters.NumberFilter(field_name="base_price", lookup_expr="gte")
    max_price  = django_filters.NumberFilter(field_name="base_price", lookup_expr="lte")
    sale       = django_filters.BooleanFilter(field_name="is_sale")
    new        = django_filters.BooleanFilter(field_name="is_new")
    exclusive  = django_filters.BooleanFilter(field_name="is_exclusive")
    limited    = django_filters.BooleanFilter(field_name="is_limited")
    material   = django_filters.CharFilter(method="filter_material")
    size       = django_filters.CharFilter(method="filter_size")
    tag        = django_filters.CharFilter(method="filter_tag")

    class Meta:
        model = Product
        fields = ["category", "artist", "min_price", "max_price", "sale", "new", "exclusive", "limited", "material", "size", "tag"]

    def filter_category(self, queryset, name, value):
        normalized = (value or "").strip().lower()
        if normalized in {"figures", "figure"}:
            return queryset.filter(category__slug="figures")
        if normalized in {"wallpanels", "wallpanel", "panels", "panel"}:
            return queryset.filter(category__slug="wallpanels")
        return queryset.filter(category__slug__iexact=normalized)

    def filter_artist(self, queryset, name, value):
        # Accept comma-separated list of artist handles
        handles = [h.strip().lower() for h in (value or "").split(",") if h.strip()]
        if not handles:
            return queryset
        return queryset.filter(artist__handle__in=handles)

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
