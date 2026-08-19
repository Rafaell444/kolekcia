from rest_framework import serializers
from django.db.models import Sum

from .models import PointTransaction, PointsMarketItem, PointsMarketRedemption, PointsMarketShippingPaymentSession
from .services import TIER_SALE_BONUS_PERCENTS, get_tier_for_points


class LoyaltyProfileSerializer(serializers.Serializer):
    spendable_points = serializers.IntegerField()
    lifetime_points = serializers.IntegerField()
    pending_points = serializers.SerializerMethodField()
    tier = serializers.SerializerMethodField()

    def get_pending_points(self, obj):
        total = (
            PointTransaction.objects.filter(
                user=obj,
                transaction_type=PointTransaction.TYPE_EARNED,
                status=PointTransaction.STATUS_PENDING,
            )
            .aggregate(total=Sum("points"))
            .get("total")
        )
        return total or 0

    def get_tier(self, obj):
        tier_balance = obj.spendable_points
        tier = get_tier_for_points(tier_balance)
        next_threshold = tier.next_threshold
        progress = 100 if next_threshold is None else max(0, min(
            100,
            int((tier_balance / next_threshold) * 100),
        ))
        return {
            "key": tier.key,
            "label": tier.label,
            "discount_percent": str(tier.discount_percent),
            "sale_bonus_percent": str(tier.discount_percent),
            "threshold": tier.threshold,
            "next_key": tier.next_key,
            "next_label": tier.next_label,
            "next_threshold": next_threshold,
            "next_sale_bonus_percent": str(TIER_SALE_BONUS_PERCENTS.get(tier.next_key, tier.discount_percent)) if tier.next_key else None,
            "points_to_next": max(0, (next_threshold or tier_balance) - tier_balance),
            "progress_percent": progress,
            "point_balance": tier_balance,
        }


class PointTransactionSerializer(serializers.ModelSerializer):
    market_item_name = serializers.CharField(source="market_item.name", read_only=True, allow_null=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True, allow_null=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = PointTransaction
        fields = (
            "id",
            "transaction_type",
            "status",
            "points",
            "description",
            "available_at",
            "order_number",
            "market_item_name",
            "user_email",
            "user_name",
            "metadata",
            "created_at",
        )
        read_only_fields = fields

    def get_user_name(self, obj):
        full_name = f"{getattr(obj.user, 'first_name', '')} {getattr(obj.user, 'last_name', '')}".strip()
        return full_name or getattr(obj.user, "username", "") or obj.user.email


class PointsMarketItemSerializer(serializers.ModelSerializer):
    is_locked = serializers.BooleanField(read_only=True)
    can_purchase = serializers.SerializerMethodField()
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True, allow_null=True)

    class Meta:
        model = PointsMarketItem
        fields = (
            "id",
            "name",
            "description",
            "vendor",
            "vendor_name",
            "vendor_slug",
            "main_image_url",
            "image_urls",
            "point_cost",
            "stock_quantity",
            "item_type",
            "voucher_discount_type",
            "voucher_discount_value",
            "voucher_min_order_value",
            "is_active",
            "is_locked",
            "can_purchase",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "vendor_name", "vendor_slug", "is_locked", "can_purchase", "created_at", "updated_at")

    def validate_image_urls(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Images must be a list of URLs.")
        cleaned = []
        for url in value:
            if not isinstance(url, str) or not url.strip():
                continue
            cleaned.append(url.strip())
        return cleaned[:12]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        item_type = attrs.get("item_type", getattr(self.instance, "item_type", PointsMarketItem.TYPE_DIGITAL))
        voucher_value = attrs.get("voucher_discount_value", getattr(self.instance, "voucher_discount_value", 0))
        if item_type == PointsMarketItem.TYPE_DIGITAL and voucher_value <= 0:
            raise serializers.ValidationError({"voucher_discount_value": "Digital voucher rewards need a discount value greater than zero."})
        if item_type == PointsMarketItem.TYPE_PHYSICAL:
            vendor = attrs.get("vendor", getattr(self.instance, "vendor", None))
            if vendor is None:
                raise serializers.ValidationError({"vendor": "Physical reward products need a vendor so shipping options can be resolved."})
        main_image_url = attrs.get("main_image_url", getattr(self.instance, "main_image_url", ""))
        image_urls = attrs.get("image_urls", getattr(self.instance, "image_urls", []))
        if main_image_url and main_image_url not in image_urls:
            attrs["image_urls"] = [main_image_url, *list(image_urls)]
        elif not main_image_url and image_urls:
            attrs["main_image_url"] = image_urls[0]
        return attrs

    def get_can_purchase(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return False
        return obj.is_active and obj.stock_quantity > 0 and user.spendable_points >= obj.point_cost


class PointsMarketRedemptionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)
    market_item_name = serializers.CharField(source="market_item.name", read_only=True, allow_null=True)
    transaction_id = serializers.IntegerField(source="transaction.id", read_only=True, allow_null=True)

    class Meta:
        model = PointsMarketRedemption
        fields = (
            "id",
            "status",
            "user_email",
            "user_name",
            "market_item",
            "market_item_name",
            "transaction_id",
            "item_name",
            "item_image_url",
            "point_cost",
            "shipping_name",
            "shipping_line1",
            "shipping_line2",
            "shipping_city",
            "shipping_state",
            "shipping_zip",
            "shipping_country",
            "shipping_email",
            "shipping_phone",
            "shipping_type",
            "shipping_label",
            "shipping_price",
            "shipping_currency",
            "tracking_code",
            "admin_note",
            "shipped_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class PointsMarketShippingPaymentSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointsMarketShippingPaymentSession
        fields = (
            "token",
            "status",
            "item_name",
            "item_image_url",
            "point_cost",
            "shipping_name",
            "shipping_line1",
            "shipping_line2",
            "shipping_city",
            "shipping_state",
            "shipping_zip",
            "shipping_country",
            "shipping_email",
            "shipping_phone",
            "shipping_type",
            "shipping_label",
            "shipping_price",
            "shipping_currency",
            "expires_at",
            "paid_at",
            "created_at",
        )
        read_only_fields = fields
