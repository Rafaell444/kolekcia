from rest_framework import serializers
from .models import Tenant
from apps.products.serializers import ProductListSerializer


class TenantSerializer(serializers.ModelSerializer):
    products = ProductListSerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = ("id", "name", "product_count", "products", "created_at")

    def get_product_count(self, obj):
        return obj.products.count()
