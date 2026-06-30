import django_filters
from .models import Product


class ProductFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(method="filter_category")
    artist   = django_filters.CharFilter(field_name="artist__handle", lookup_expr="iexact")
    min_price = django_filters.NumberFilter(field_name="base_price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="base_price", lookup_expr="lte")
    sale      = django_filters.BooleanFilter(field_name="is_sale")
    new       = django_filters.BooleanFilter(field_name="is_new")
    exclusive = django_filters.BooleanFilter(field_name="is_exclusive")
    limited   = django_filters.BooleanFilter(field_name="is_limited")

    class Meta:
        model = Product
        fields = ["category", "artist", "min_price", "max_price", "sale", "new", "exclusive", "limited"]

    def filter_category(self, queryset, name, value):
        normalized = (value or "").strip().lower()
        if normalized in {"figures", "figure"}:
            return queryset.filter(category__slug="figures")
        if normalized in {"wallpanels", "wallpanel", "panels", "panel"}:
            return queryset.filter(category__slug="wallpanels")
        return queryset.filter(category__slug__iexact=normalized)
