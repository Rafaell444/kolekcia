from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .models import GamificationProfile, Badge, XPLog, XPRule, UserBadge
from .serializers import (
    GamificationProfileSerializer,
    BadgeSerializer,
    XPLogSerializer,
    XPRuleSerializer,
    UserBadgeSerializer,
)


class GamificationProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services import sync_earned_badges_from_xp
        sync_earned_badges_from_xp(request.user)
        profile, _ = GamificationProfile.objects.get_or_create(user=request.user)
        return Response(GamificationProfileSerializer(profile).data)


class MyBadgesView(generics.ListAPIView):
    serializer_class = UserBadgeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        from .services import sync_earned_badges_from_xp
        sync_earned_badges_from_xp(self.request.user)
        return UserBadge.objects.filter(user=self.request.user).select_related("badge", "badge__prize_promo").order_by("-earned_at")


class MarkBadgesSeenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = UserBadge.objects.filter(user=request.user, seen_at__isnull=True).update(seen_at=timezone.now())
        return Response({"marked": updated})


class BadgeListView(generics.ListAPIView):
    queryset = Badge.objects.select_related("prize_promo").all()
    serializer_class = BadgeSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class XPLogListView(generics.ListAPIView):
    serializer_class = XPLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return XPLog.objects.filter(user=self.request.user).order_by("-created_at")


class LeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        profiles = GamificationProfile.objects.select_related("user").order_by("-xp")[:20]
        data = [
            {
                "rank": i + 1,
                "user_name": p.user.name or p.user.email,
                "avatar": p.user.avatar,
                "xp": p.xp,
                "level": p.level,
            }
            for i, p in enumerate(profiles)
        ]
        return Response(data)


class XPRuleListView(generics.ListAPIView):
    serializer_class = XPRuleSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return XPRule.objects.all().order_by("-xp_amount", "action_key")
