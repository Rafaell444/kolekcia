from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from .models import Auction, AuctionBid
from .serializers import AuctionSerializer, PlaceBidSerializer, AuctionBidSerializer


class BidThrottle(ScopedRateThrottle):
    scope = "bid"


class AuctionListView(generics.ListAPIView):
    serializer_class = AuctionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Auction.objects.prefetch_related("bids__user").select_related("product")


class AuctionDetailView(generics.RetrieveAPIView):
    serializer_class = AuctionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Auction.objects.prefetch_related("bids__user").select_related("product")


class PlaceBidView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [BidThrottle]

    @transaction.atomic
    def post(self, request, pk):
        serializer = PlaceBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]

        try:
            # Row-level lock prevents simultaneous bid race conditions
            auction = Auction.objects.select_for_update().get(pk=pk)
        except Auction.DoesNotExist:
            return Response({"detail": "Auction not found."}, status=status.HTTP_404_NOT_FOUND)

        if auction.ends_at <= timezone.now():
            return Response({"detail": "This auction has ended."}, status=status.HTTP_400_BAD_REQUEST)

        current = auction.current_bid
        if amount <= current:
            return Response(
                {"detail": f"Your bid must be higher than the current bid of ${current:.2f}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount < current + 1:
            return Response(
                {"detail": f"Minimum bid increment is $1.00. Bid at least ${float(current) + 1:.2f}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        AuctionBid.objects.create(auction=auction, user=request.user, amount=amount)

        try:
            from apps.gamification.services import award_xp
            award_xp(request.user, "bid_placed")
        except Exception:
            pass

        # Return fresh auction data after the bid
        auction.refresh_from_db()
        return Response(AuctionSerializer(auction).data, status=status.HTTP_201_CREATED)


class AuctionLeaderboardView(APIView):
    """Bid history leaderboard for a single auction."""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            auction = Auction.objects.get(pk=pk)
        except Auction.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        bids = (
            AuctionBid.objects
            .filter(auction=auction)
            .select_related("user")
            .order_by("-amount")[:20]
        )
        return Response(AuctionBidSerializer(bids, many=True).data)


class GlobalLeaderboardView(APIView):
    """Top auction winners across all ended auctions."""
    permission_classes = [AllowAny]

    def get(self, request):
        now = timezone.now()
        ended = Auction.objects.filter(ends_at__lt=now).prefetch_related(
            "bids__user"
        )

        wins: dict = {}
        for auction in ended:
            top_bid = auction.bids.order_by("-amount").first()
            if not top_bid:
                continue
            uid = str(top_bid.user_id)
            display_name = top_bid.user.name or top_bid.user.email.split("@")[0]
            if uid not in wins:
                wins[uid] = {"name": display_name, "wins": 0, "total_spent": 0.0}
            wins[uid]["wins"] += 1
            wins[uid]["total_spent"] += float(top_bid.amount)

        leaderboard = sorted(wins.values(), key=lambda x: (-x["wins"], -x["total_spent"]))[:10]
        for i, entry in enumerate(leaderboard, 1):
            entry["rank"] = i
            entry["total_spent"] = round(entry["total_spent"], 2)

        # If no ended auctions, fall back to top bidders across all auctions
        if not leaderboard:
            from django.db.models import Sum, Count
            top_bidders = (
                AuctionBid.objects
                .values("user__name", "user__email")
                .annotate(bid_count=Count("id"), total=Sum("amount"))
                .order_by("-bid_count")[:10]
            )
            leaderboard = [
                {
                    "rank": i + 1,
                    "name": b["user__name"] or b["user__email"].split("@")[0],
                    "wins": 0,
                    "total_spent": float(b["total"] or 0),
                    "bid_count": b["bid_count"],
                }
                for i, b in enumerate(top_bidders)
            ]

        return Response(leaderboard)
