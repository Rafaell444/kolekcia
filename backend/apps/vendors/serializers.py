from rest_framework import serializers
from .models import Vendor


class VendorSerializer(serializers.ModelSerializer):
    owner_email = serializers.CharField(source="user.email", read_only=True)
    owner_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = Vendor
        fields = (
            "id", "name", "slug", "logo_url", "description", "payment_email",
            "custom_product_type", "custom_product_description", "custom_cover_url",
            "owner_email", "owner_name", "created_at",
        )


class VendorPublicSerializer(serializers.ModelSerializer):
    """Minimal public info used on the custom order picker page."""
    class Meta:
        model = Vendor
        fields = ("id", "name", "slug", "logo_url", "custom_product_type", "custom_product_description", "custom_cover_url")
