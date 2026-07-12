from rest_framework import serializers
from apps.promo.models import PromoCode
from .models import GamificationProfile, XPLog, Badge, UserBadge, XPRule


class XPLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = XPLog
        fields = ("id", "action", "xp_amount", "created_at")


class BadgeSerializer(serializers.ModelSerializer):
    prize_promo_id = serializers.IntegerField(source="prize_promo.id", read_only=True, allow_null=True)
    prize_promo_code = serializers.CharField(source="prize_promo.code", read_only=True, allow_null=True)

    class Meta:
        model = Badge
        fields = (
            "id", "name", "icon", "rarity", "description", "trigger_action",
            "prize_promo_id", "prize_promo_code", "prize_description",
        )


class BadgeWriteSerializer(serializers.ModelSerializer):
    prize_promo_id = serializers.IntegerField(allow_null=True, required=False)

    class Meta:
        model = Badge
        fields = (
            "id", "name", "icon", "rarity", "description", "trigger_action",
            "prize_promo_id", "prize_description",
        )
        read_only_fields = ("id",)

    def validate_prize_promo_id(self, value):
        if value is None:
            return None
        if not PromoCode.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Selected promo code does not exist.")
        return value

    def create(self, validated_data):
        promo_id = validated_data.pop("prize_promo_id", None)
        badge = Badge.objects.create(**validated_data, prize_promo_id=promo_id)
        return badge

    def update(self, instance, validated_data):
        promo_id = validated_data.pop("prize_promo_id", serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if promo_id is not serializers.empty:
            instance.prize_promo_id = promo_id
        instance.save()
        return instance


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer()
    is_new = serializers.SerializerMethodField()
    granted_promo_code = serializers.SerializerMethodField()

    class Meta:
        model = UserBadge
        fields = ("id", "badge", "earned_at", "seen_at", "is_new", "granted_promo_code")

    def get_is_new(self, obj):
        return obj.seen_at is None

    def get_granted_promo_code(self, obj):
        from apps.promo.models import UserPromoGrant
        grant = UserPromoGrant.objects.filter(user=obj.user, source_badge=obj.badge).select_related("promo").first()
        return grant.promo.code if grant else None


class GamificationProfileSerializer(serializers.ModelSerializer):
    recent_xp = serializers.SerializerMethodField()
    earned_badges = UserBadgeSerializer(source="user.badges", many=True, read_only=True)
    unseen_badge_count = serializers.SerializerMethodField()

    class Meta:
        model = GamificationProfile
        fields = ("xp", "points", "level", "streak_days", "recent_xp", "earned_badges", "unseen_badge_count")

    def get_recent_xp(self, obj):
        logs = XPLog.objects.filter(user=obj.user).order_by("-created_at")[:10]
        return XPLogSerializer(logs, many=True).data

    def get_unseen_badge_count(self, obj):
        return obj.user.badges.filter(seen_at__isnull=True).count()


class XPRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = XPRule
        fields = ("id", "action_key", "xp_amount", "is_one_time", "description")
