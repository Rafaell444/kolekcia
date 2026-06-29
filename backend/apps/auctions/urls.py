from django.urls import path
from .views import AuctionListView, AuctionDetailView, PlaceBidView, AuctionLeaderboardView

urlpatterns = [
    path("", AuctionListView.as_view(), name="auction-list"),
    path("<int:pk>/", AuctionDetailView.as_view(), name="auction-detail"),
    path("<int:pk>/bid/", PlaceBidView.as_view(), name="auction-bid"),
    path("<int:pk>/leaderboard/", AuctionLeaderboardView.as_view(), name="auction-leaderboard"),
]
