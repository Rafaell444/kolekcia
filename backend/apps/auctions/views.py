from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from .models import Auction, AuctionBid
from .serializers import AuctionSerializer, PlaceBidSerializer, AuctionBidSerializer


class BidThrottle(ScopedRateThrottle):
    scope = "bid"


class AuctionListView(generics.ListAPIView):
    queryset = Auction.objects.prefetch_related("bids__user")
    serializer_class = AuctionSerializer
    permission_classes = [AllowAny]


class AuctionDetailView(generics.RetrieveAPIView):
    queryset = Auction.objects.prefetch_related("bids__user")
    serializer_class = AuctionSerializer
    permission_classes = [AllowAny]


class PlaceBidView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [BidThrottle]

    @transaction.atomic
    def post(self, request, pk):
        serializer = PlaceBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]

        try:
            auction = Auction.objects.select_for_update().get(pk=pk)
        except Auction.DoesNotExist:
            return Response({"detail": "Auction not found."}, status=status.HTTP_404_NOT_FOUND)

        if auction.ends_at <= timezone.now():
            return Response({"detail": "This auction has ended."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= auction.current_bid:
            return Response(
                {"detail": f"Bid must be higher than current bid of ${auction.current_bid}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bid = AuctionBid.objects.create(auction=auction, user=request.user, amount=amount)

        try:
            from apps.gamification.services import award_xp
            award_xp(request.user, "bid_placed")
        except Exception:
            pass

        return Response(AuctionSerializer(auction).data, status=status.HTTP_201_CREATED)


class AuctionLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            auction = Auction.objects.get(pk=pk)
        except Auction.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        bids = AuctionBid.objects.filter(auction=auction).select_related("user").order_by("-amount")[:20]
        return Response(AuctionBidSerializer(bids, many=True).data)
