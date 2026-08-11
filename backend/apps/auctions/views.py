from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from rest_framework.exceptions import ValidationError
from apps.admin_api.permissions import IsAdminOrVendor
from .models import Auction, AuctionBid, AuctionBidderBan, AuctionChatMessage
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
        submitted_amount = serializer.validated_data["amount"]
        submitted_currency = serializer.validated_data["currency"]
        fx_rate = None
        amount = submitted_amount
        if submitted_currency == "GEL":
            from .services import gel_to_usd, get_usd_gel_rate

            fx_rate = get_usd_gel_rate()
            if fx_rate is None:
                return Response(
                    {"detail": "The official NBG exchange rate is temporarily unavailable. Please try again shortly."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            amount = gel_to_usd(submitted_amount, fx_rate)

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

        if AuctionBidderBan.objects.filter(
            Q(vendor__isnull=True) | Q(vendor_id=auction.vendor_id),
            user=request.user,
            is_active=True,
        ).exists():
            return Response(
                {"detail": "Your account is not eligible to bid in this seller's auctions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        current = auction.current_bid
        if amount <= current:
            current_display = current
            if submitted_currency == "GEL":
                from .services import usd_to_gel
                current_display = usd_to_gel(current, fx_rate)
            return Response(
                {"detail": f"Your bid must be higher than {current_display:.2f} {submitted_currency}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount < current + 1:
            minimum_display = current + 1
            if submitted_currency == "GEL":
                from .services import usd_to_gel
                minimum_display = usd_to_gel(current + 1, fx_rate)
            return Response(
                {"detail": f"Bid at least {minimum_display:.2f} {submitted_currency}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        AuctionBid.objects.create(
            auction=auction,
            user=request.user,
            amount=amount,
            submitted_amount=submitted_amount,
            submitted_currency=submitted_currency,
            fx_rate_used=fx_rate,
        )
        auction.refresh_live_flag()
        auction.save(update_fields=["is_live"])

        try:
            from apps.gamification.services import award_xp
            award_xp(request.user, "bid_placed")
        except Exception:
            pass

        auction.refresh_from_db()
        return Response(
            AuctionSerializer(auction, context={"usd_gel_rate": fx_rate}).data,
            status=status.HTTP_201_CREATED,
        )


class AuctionLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, lookup):
        try:
            auction = resolve_auction(lookup)
        except Auction.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        bids = (
            AuctionBid.objects
            .filter(auction=auction, is_disqualified=False)
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
            top_bid = auction.bids.filter(is_disqualified=False).order_by("-amount").first()
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
                .filter(is_disqualified=False)
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

        from decimal import Decimal
        from .services import get_usd_gel_rate, usd_to_gel

        usd_gel_rate = get_usd_gel_rate()
        for entry in leaderboard:
            total_usd = Decimal(str(entry["total_spent"]))
            total_gel = usd_to_gel(total_usd, usd_gel_rate) if usd_gel_rate else None
            entry["total_spent_usd"] = float(total_usd)
            entry["total_spent_gel"] = float(total_gel) if total_gel is not None else None

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
        ctx["include_bidder_private_data"] = True
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
        ctx["include_bidder_private_data"] = True
        return ctx

    def perform_destroy(self, instance):
        if instance.inventory_reserved and instance.winner_payment_status != Auction.PAYMENT_PAID:
            from .services import release_auction_inventory
            release_auction_inventory(instance)
        instance.delete()


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
        return Response(AuctionSerializer(auction, context={
            "include_all_bids": True,
            "include_bidder_private_data": True,
        }).data)


def _managed_auction_response(auction):
    return AuctionSerializer(auction, context={
        "include_all_bids": True,
        "include_bidder_private_data": True,
    }).data


class VendorAuctionDisqualifyBidderView(VendorAuctionMixin, APIView):
    permission_classes = [IsAdminOrVendor]

    @transaction.atomic
    def post(self, request, pk, bid_id):
        auction = self.get_queryset().select_for_update().filter(pk=pk).first()
        if not auction:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        bid = auction.bids.select_related("user").filter(pk=bid_id).first()
        if not bid:
            return Response({"detail": "Bid not found."}, status=status.HTTP_404_NOT_FOUND)
        if not auction.is_ended():
            return Response(
                {"detail": "A bidder can only be disqualified after the auction ends."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if auction.winner_id != bid.user_id:
            return Response(
                {"detail": "Only the currently assigned winner can be disqualified for non-payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get("reason") or "Winner did not complete payment.").strip()
        auction.bids.filter(user=bid.user, is_disqualified=False).update(
            is_disqualified=True,
            disqualified_at=timezone.now(),
            disqualification_reason=reason,
        )
        AuctionBidderBan.objects.update_or_create(
            user=bid.user,
            vendor=auction.vendor,
            defaults={"reason": reason, "is_active": True, "created_by": request.user},
        )
        if auction.winner_id == bid.user_id:
            auction.winner = None
            auction.winning_amount = None
            auction.winner_payment_status = Auction.PAYMENT_FAILED
            auction.is_replacement_winner = False
            auction.save(update_fields=("winner", "winning_amount", "winner_payment_status", "is_replacement_winner"))
        auction.refresh_from_db()
        return Response(_managed_auction_response(auction))


class VendorAuctionPromoteBidView(VendorAuctionMixin, APIView):
    permission_classes = [IsAdminOrVendor]

    @transaction.atomic
    def post(self, request, pk, bid_id):
        auction = self.get_queryset().select_for_update().filter(pk=pk).first()
        if not auction:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not auction.is_ended():
            return Response(
                {"detail": "A replacement winner can only be selected after the auction ends."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if auction.winner_id:
            return Response(
                {"detail": "Disqualify the current winner before selecting a replacement."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        bid = auction.bids.select_related("user").filter(pk=bid_id, is_disqualified=False).first()
        if not bid:
            return Response({"detail": "Eligible bid not found."}, status=status.HTTP_404_NOT_FOUND)
        next_eligible = auction.bids.filter(is_disqualified=False).order_by("-amount", "placed_at").first()
        if not next_eligible or next_eligible.pk != bid.pk:
            return Response(
                {"detail": "Select the highest remaining eligible bid as the replacement winner."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        auction.winner = bid.user
        auction.winning_amount = bid.amount
        auction.winner_payment_status = Auction.PAYMENT_PENDING
        auction.is_replacement_winner = True
        auction.save(update_fields=("winner", "winning_amount", "winner_payment_status", "is_replacement_winner"))
        return Response(_managed_auction_response(auction))


class VendorAuctionSecondChanceEmailView(VendorAuctionMixin, APIView):
    permission_classes = [IsAdminOrVendor]

    def post(self, request, pk):
        from django.conf import settings
        from apps.emails.service import send_template_email

        auction = self.get_queryset().filter(pk=pk).first()
        if not auction:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if (
            not auction.winner_id
            or auction.winner_payment_status != Auction.PAYMENT_PENDING
            or not auction.is_replacement_winner
        ):
            return Response(
                {"detail": "Select an unpaid replacement winner first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sent = send_template_email(
            "auction_second_chance",
            auction.winner.email,
            {
                "winner_name": auction.winner.name or auction.winner.email.split("@")[0],
                "auction_title": auction.title,
                "winning_amount": str(auction.winning_amount or ""),
                "admin_note": (request.data.get("admin_note") or "").strip(),
                "payment_link": f"{settings.FRONTEND_URL}/auctions/{auction.slug}",
            },
            vendor=auction.vendor,
        )
        if not sent:
            return Response(
                {"detail": "The email could not be sent. Check the template and email configuration."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": f"Replacement winner email sent to {auction.winner.email}."})


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
