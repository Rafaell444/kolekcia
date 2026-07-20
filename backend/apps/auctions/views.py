from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from rest_framework.exceptions import ValidationError
from apps.admin_api.permissions import IsAdminOrVendor
from .models import Auction, AuctionBid, AuctionChatMessage
from .serializers import (
    AuctionSerializer,
    AuctionWriteSerializer,
    PlaceBidSerializer,
    AuctionBidSerializer,
    AuctionChatMessageSerializer,
    AuctionChatPostSerializer,
)


def resolve_auction(lookup: str) -> Auction:
    if str(lookup).isdigit():
        return Auction.objects.get(pk=int(lookup))
    return Auction.objects.get(slug=lookup)


class BidThrottle(ScopedRateThrottle):
    scope = "bid"


class AuctionListView(generics.ListAPIView):
    serializer_class = AuctionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return (
            Auction.objects.exclude(status=Auction.STATUS_INACTIVE)
            .prefetch_related("bids__user")
            .select_related("product", "vendor", "winner")
        )


class AuctionDetailView(generics.RetrieveAPIView):
    serializer_class = AuctionSerializer
    permission_classes = [AllowAny]
    lookup_url_kwarg = "lookup"

    def get_object(self):
        return resolve_auction(self.kwargs["lookup"])


class PlaceBidView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [BidThrottle]

    @transaction.atomic
    def post(self, request, lookup):
        serializer = PlaceBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]

        try:
            auction = Auction.objects.select_for_update().get(pk=resolve_auction(lookup).pk)
        except Auction.DoesNotExist:
            return Response({"detail": "Auction not found."}, status=status.HTTP_404_NOT_FOUND)

        if auction.status != Auction.STATUS_ACTIVE:
            return Response({"detail": "This auction is not active."}, status=status.HTTP_400_BAD_REQUEST)

        if auction.is_upcoming():
            return Response({"detail": "Bidding has not started yet."}, status=status.HTTP_400_BAD_REQUEST)

        if auction.ends_at <= timezone.now():
            auction.finalize_if_ended()
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
        auction.refresh_live_flag()
        auction.save(update_fields=["is_live"])

        try:
            from apps.gamification.services import award_xp
            award_xp(request.user, "bid_placed")
        except Exception:
            pass

        auction.refresh_from_db()
        return Response(AuctionSerializer(auction).data, status=status.HTTP_201_CREATED)


class AuctionLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, lookup):
        try:
            auction = resolve_auction(lookup)
        except Auction.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        bids = (
            AuctionBid.objects
            .filter(auction=auction)
            .select_related("user")
            .order_by("-placed_at")
        )
        return Response(AuctionBidSerializer(bids, many=True).data)


class AuctionChatView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, lookup):
        try:
            auction = resolve_auction(lookup)
        except Auction.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        messages = auction.chat_messages.select_related("user").order_by("created_at")[:200]
        return Response(AuctionChatMessageSerializer(messages, many=True).data)

    def post(self, request, lookup):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            auction = resolve_auction(lookup)
        except Auction.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not auction.is_biddable():
            return Response({"detail": "Chat is only available during live auctions."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AuctionChatPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        text = serializer.validated_data["text"].strip()
        if not text:
            return Response({"detail": "Message cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        msg = AuctionChatMessage.objects.create(auction=auction, user=request.user, text=text)

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer:
            payload = AuctionChatMessageSerializer(msg).data
            async_to_sync(channel_layer.group_send)(
                f"auction_{auction.pk}",
                {"type": "chat_message", "message": payload},
            )

        return Response(AuctionChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class GlobalLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        now = timezone.now()
        ended = Auction.objects.filter(ends_at__lt=now).prefetch_related("bids__user")

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


class VendorAuctionMixin:
    def get_vendor(self):
        user = self.request.user
        if hasattr(user, "vendor_profile"):
            return user.vendor_profile
        return None

    def get_queryset(self):
        vendor = self.get_vendor()
        qs = Auction.objects.prefetch_related("bids__user").select_related("product", "vendor", "winner")
        if vendor and not self.request.user.is_staff:
            return qs.filter(vendor=vendor)
        return qs


class VendorAuctionListView(VendorAuctionMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminOrVendor]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AuctionWriteSerializer
        return AuctionSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["vendor"] = self.get_vendor()
        ctx["include_all_bids"] = True
        return ctx

    def perform_create(self, serializer):
        vendor = self.get_vendor()
        if not vendor and not self.request.user.is_staff:
            raise ValidationError({"detail": "Vendor profile required."})
        serializer.save()


class VendorAuctionDetailView(VendorAuctionMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrVendor]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return AuctionWriteSerializer
        return AuctionSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["include_all_bids"] = True
        return ctx


class VendorAuctionMarkPaidView(VendorAuctionMixin, APIView):
    permission_classes = [IsAdminOrVendor]

    def post(self, request, pk):
        vendor = self.get_vendor()
        try:
            auction = self.get_queryset().get(pk=pk)
        except Auction.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if vendor and auction.vendor_id != vendor.id and not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        auction.winner_payment_status = Auction.PAYMENT_PAID
        auction.status = Auction.STATUS_BOUGHT
        auction.paid_at = timezone.now()
        if not auction.winning_amount:
            auction.winning_amount = auction.current_bid
        auction.save()
        return Response(AuctionSerializer(auction, context={"include_all_bids": True}).data)


class AuctionSubscribeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .models import AuctionSubscriber

        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else None
        _, created = AuctionSubscriber.objects.get_or_create(
            email=email,
            defaults={"user": user, "is_active": True},
        )
        return Response(
            {"detail": "Subscribed successfully." if created else "Already subscribed.", "is_new": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
