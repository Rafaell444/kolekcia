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
    VendorAuctionDisqualifyBidderView,
    VendorAuctionPromoteBidView,
    VendorAuctionSecondChanceEmailView,
    AuctionSubscribeView,
)

urlpatterns = [
    path("", AuctionListView.as_view(), name="auction-list"),
    path("subscribe/", AuctionSubscribeView.as_view(), name="auction-subscribe"),
    path("leaderboard/", GlobalLeaderboardView.as_view(), name="auction-global-leaderboard"),
    path("vendor/", VendorAuctionListView.as_view(), name="vendor-auction-list"),
    path("vendor/<int:pk>/", VendorAuctionDetailView.as_view(), name="vendor-auction-detail"),
    path("vendor/<int:pk>/mark-paid/", VendorAuctionMarkPaidView.as_view(), name="vendor-auction-mark-paid"),
    path("vendor/<int:pk>/bids/<int:bid_id>/disqualify/", VendorAuctionDisqualifyBidderView.as_view(), name="vendor-auction-disqualify"),
    path("vendor/<int:pk>/bids/<int:bid_id>/promote/", VendorAuctionPromoteBidView.as_view(), name="vendor-auction-promote"),
    path("vendor/<int:pk>/send-second-chance/", VendorAuctionSecondChanceEmailView.as_view(), name="vendor-auction-second-chance"),
    path("<str:lookup>/", AuctionDetailView.as_view(), name="auction-detail"),
    path("<str:lookup>/bid/", PlaceBidView.as_view(), name="auction-bid"),
    path("<str:lookup>/leaderboard/", AuctionLeaderboardView.as_view(), name="auction-leaderboard"),
    path("<str:lookup>/chat/", AuctionChatView.as_view(), name="auction-chat"),
]
