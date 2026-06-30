from django.urls import path
from .views import GamificationProfileView, BadgeListView, XPLogListView, LeaderboardView, XPRuleListView

urlpatterns = [
    path("profile/", GamificationProfileView.as_view(), name="gamification-profile"),
    path("badges/", BadgeListView.as_view(), name="badge-list"),
    path("xp-log/", XPLogListView.as_view(), name="xp-log"),
    path("xp-rules/", XPRuleListView.as_view(), name="xp-rule-list"),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
]
