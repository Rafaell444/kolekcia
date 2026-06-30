from rest_framework import serializers
from .models import GamificationProfile, XPLog, Badge, UserBadge, XPRule


class XPLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = XPLog
        fields = ("id", "action", "xp_amount", "created_at")


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ("id", "name", "icon", "rarity", "description", "trigger_action")


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer()

    class Meta:
        model = UserBadge
        fields = ("id", "badge", "earned_at")


class GamificationProfileSerializer(serializers.ModelSerializer):
    recent_xp = serializers.SerializerMethodField()
    earned_badges = UserBadgeSerializer(source="user.badges", many=True, read_only=True)

    class Meta:
        model = GamificationProfile
        fields = ("xp", "points", "level", "streak_days", "recent_xp", "earned_badges")

    def get_recent_xp(self, obj):
        logs = XPLog.objects.filter(user=obj.user).order_by("-created_at")[:10]
        return XPLogSerializer(logs, many=True).data


class XPRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = XPRule
        fields = ("id", "action_key", "xp_amount", "is_one_time")
