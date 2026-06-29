from rest_framework import serializers
from .models import PromoCode, PromoCodeUsage


class PromoCodeSerializer(serializers.ModelSerializer):
    usage_count = serializers.SerializerMethodField()

    class Meta:
        model = PromoCode
        fields = (
            "id", "code", "discount_type", "discount_value",
            "max_uses", "max_uses_per_user", "min_order_value",
            "expires_at", "is_active", "usage_count", "created_at",
        )

    def get_usage_count(self, obj):
        return obj.usages.count()
