from django.urls import path
from .views import (
    AuctionListView,
    AuctionDetailView,
    PlaceBidView,
    AuctionLeaderboardView,
    GlobalLeaderboardView,
    AuctionChatView,
    VendorAuctionListView,
    VendorAuctionDetailView,
    VendorAuctionMarkPaidView,
)

urlpatterns = [
    path("", AuctionListView.as_view(), name="auction-list"),
    path("leaderboard/", GlobalLeaderboardView.as_view(), name="auction-global-leaderboard"),
    path("vendor/", VendorAuctionListView.as_view(), name="vendor-auction-list"),
    path("vendor/<int:pk>/", VendorAuctionDetailView.as_view(), name="vendor-auction-detail"),
    path("vendor/<int:pk>/mark-paid/", VendorAuctionMarkPaidView.as_view(), name="vendor-auction-mark-paid"),
    path("<str:lookup>/", AuctionDetailView.as_view(), name="auction-detail"),
    path("<str:lookup>/bid/", PlaceBidView.as_view(), name="auction-bid"),
    path("<str:lookup>/leaderboard/", AuctionLeaderboardView.as_view(), name="auction-leaderboard"),
    path("<str:lookup>/chat/", AuctionChatView.as_view(), name="auction-chat"),
]
