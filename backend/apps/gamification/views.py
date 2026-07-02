from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GamificationProfile, Badge, XPLog, XPRule
from .serializers import GamificationProfileSerializer, BadgeSerializer, XPLogSerializer, XPRuleSerializer


class GamificationProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = GamificationProfile.objects.get_or_create(user=request.user)
        return Response(GamificationProfileSerializer(profile).data)


class BadgeListView(generics.ListAPIView):
    queryset = Badge.objects.all()
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
