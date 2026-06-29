from django.urls import path
from .views import AuctionListView, AuctionDetailView, PlaceBidView, AuctionLeaderboardView, GlobalLeaderboardView

urlpatterns = [
    path("", AuctionListView.as_view(), name="auction-list"),
    path("leaderboard/", GlobalLeaderboardView.as_view(), name="auction-global-leaderboard"),
    path("<int:pk>/", AuctionDetailView.as_view(), name="auction-detail"),
    path("<int:pk>/bid/", PlaceBidView.as_view(), name="auction-bid"),
    path("<int:pk>/leaderboard/", AuctionLeaderboardView.as_view(), name="auction-leaderboard"),
]
