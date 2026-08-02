from rest_framework import serializers
from .models import PromoCode, PromoCodeUsage


def _product_queryset():
    from apps.products.models import Product
    return Product.objects.all()


def _category_queryset():
    from apps.products.models import Category
    return Category.objects.all()


class LazyPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """PrimaryKeyRelatedField that accepts a callable for queryset (lazy import)."""

    def __init__(self, queryset_factory=None, **kwargs):
        self._queryset_factory = queryset_factory
        super().__init__(**kwargs)

    def get_queryset(self):
        if self._queryset_factory:
            return self._queryset_factory()
        return super().get_queryset()


class PromoCodeSerializer(serializers.ModelSerializer):
    usage_count = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="owner.email", read_only=True, allow_null=True)
    products = LazyPrimaryKeyRelatedField(
        many=True, required=False, allow_empty=True,
        queryset_factory=_product_queryset,
    )
    categories = LazyPrimaryKeyRelatedField(
        many=True, required=False, allow_empty=True,
        queryset_factory=_category_queryset,
    )
    product_names = serializers.SerializerMethodField()
    category_names = serializers.SerializerMethodField()

    class Meta:
        model = PromoCode
        fields = (
            "id", "code", "owner", "owner_email", "discount_type", "discount_value",
            "max_uses", "max_uses_per_user", "min_order_value",
            "expires_at", "is_active", "usage_count", "created_at",
            "products", "categories", "product_names", "category_names",
        )

    def get_usage_count(self, obj):
        return obj.usages.count()

    def get_product_names(self, obj):
        return list(obj.products.values_list("title", flat=True))

    def get_category_names(self, obj):
        return list(obj.categories.values_list("name", flat=True))
