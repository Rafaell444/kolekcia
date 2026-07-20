from rest_framework import serializers
from .models import Vendor
from apps.core.serializers import build_seo_dict


class VendorSerializer(serializers.ModelSerializer):
    owner_email = serializers.CharField(source="user.email", read_only=True)
    owner_name = serializers.CharField(source="user.name", read_only=True)
    email_template_type = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = (
            "id", "name", "slug", "logo_url", "banner_url", "description", "payment_email", "merchant_id",
            "gift_wrap_price_gel", "gift_wrap_price_usd",
            "shipping_email_subject", "shipping_email_body", "email_template_type",
            "catalog_category_slug",
            "social_website", "social_instagram", "social_facebook", "social_twitter", "social_tiktok", "social_youtube",
            "custom_product_type", "custom_product_description", "custom_cover_url",
            "owner_email", "owner_name", "created_at",
        )

    def get_email_template_type(self, obj):
        return "Shipping confirmation"


class VendorPublicSerializer(serializers.ModelSerializer):
    """Minimal public info used on the custom order picker page."""
    class Meta:
        model = Vendor
        fields = ("id", "name", "slug", "logo_url", "banner_url", "description", "catalog_category_slug", "custom_product_type", "custom_product_description", "custom_cover_url")


class VendorStorefrontSerializer(serializers.ModelSerializer):
    seo = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = (
            "name", "slug", "logo_url", "banner_url", "description",
            "social_website", "social_instagram", "social_facebook", "social_twitter", "social_tiktok", "social_youtube",
            "seo",
        )

    def get_seo(self, obj):
        return build_seo_dict(obj, og_image=obj.logo_url or "")
