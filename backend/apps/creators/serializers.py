from rest_framework import serializers

from decimal import Decimal

from apps.promo.models import PromoCode
from .models import (
    ContentCreator,
    CreatorApplication,
    CreatorLedgerEntry,
    CreatorPayoutRequest,
)
from .services import get_payout_minimum_gel


class CreatorApplicationSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)
    reviewed_by_email = serializers.EmailField(
        source="reviewed_by.email", read_only=True, allow_null=True
    )

    class Meta:
        model = CreatorApplication
        fields = (
            "id",
            "user",
            "user_email",
            "user_name",
            "phone",
            "email",
            "tiktok",
            "facebook",
            "instagram",
            "youtube",
            "country",
            "status",
            "admin_note",
            "reviewed_by_email",
            "reviewed_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "user",
            "status",
            "admin_note",
            "reviewed_by_email",
            "reviewed_at",
            "created_at",
        )


class CreatorApplicationCreateSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=40)
    email = serializers.EmailField()
    country = serializers.CharField(max_length=5, required=False, allow_blank=True, default="")
    tiktok = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    facebook = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    instagram = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    youtube = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class CreatorLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CreatorLedgerEntry
        fields = (
            "id",
            "entry_type",
            "amount",
            "currency",
            "order",
            "order_number",
            "buyer_email",
            "product_subtotal",
            "discount_percent",
            "original_amount",
            "original_currency",
            "fx_rate",
            "fx_date",
            "note",
            "created_at",
        )


class CreatorPayoutRequestSerializer(serializers.ModelSerializer):
    creator_email = serializers.EmailField(source="creator.user.email", read_only=True)
    processed_by_email = serializers.EmailField(
        source="processed_by.email", read_only=True, allow_null=True
    )

    class Meta:
        model = CreatorPayoutRequest
        fields = (
            "id",
            "creator",
            "creator_email",
            "amount",
            "currency",
            "status",
            "admin_note",
            "processed_by_email",
            "processed_at",
            "created_at",
        )
        read_only_fields = fields


class ContentCreatorSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)
    voucher_code = serializers.CharField(source="promo.code", read_only=True, allow_null=True)
    voucher_percent = serializers.DecimalField(
        source="promo.discount_value",
        max_digits=8,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    available_balance = serializers.SerializerMethodField()
    lifetime_earned = serializers.SerializerMethodField()
    pending_payout = serializers.SerializerMethodField()
    payout_minimum_gel = serializers.SerializerMethodField()

    class Meta:
        model = ContentCreator
        fields = (
            "id",
            "user",
            "user_email",
            "user_name",
            "is_active",
            "country",
            "promo",
            "voucher_code",
            "voucher_percent",
            "available_balance",
            "lifetime_earned",
            "pending_payout",
            "payout_minimum_gel",
            "created_at",
            "updated_at",
        )

    def get_available_balance(self, obj):
        return str(obj.available_balance)

    def get_lifetime_earned(self, obj):
        return str(obj.lifetime_earned)

    def get_pending_payout(self, obj):
        return str(obj.pending_payout)

    def get_payout_minimum_gel(self, obj):
        return str(get_payout_minimum_gel())


class AdminAssignVoucherSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    code = serializers.CharField(max_length=50)
    discount_percent = serializers.DecimalField(
        max_digits=8, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("100")
    )
    is_active = serializers.BooleanField(default=True)
