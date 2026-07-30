from django.utils import timezone
from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from apps.promo.models import PromoCode
from .models import (
    ContentCreator,
    CreatorApplication,
    CreatorLedgerEntry,
    CreatorPayoutRequest,
)
from .serializers import (
    CreatorApplicationCreateSerializer,
    CreatorApplicationSerializer,
    ContentCreatorSerializer,
    CreatorLedgerEntrySerializer,
    CreatorPayoutRequestSerializer,
)
from .services import get_payout_minimum_gel, notify_admins


class CreatorApplyThrottle(ScopedRateThrottle):
    scope = "creator_apply"


class CreatorApplyView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [CreatorApplyThrottle]

    def post(self, request):
        if hasattr(request.user, "content_creator") and request.user.content_creator.is_active:
            return Response(
                {"detail": "You are already an active content creator."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pending = CreatorApplication.objects.filter(
            user=request.user, status=CreatorApplication.STATUS_PENDING
        ).exists()
        if pending:
            return Response(
                {"detail": "You already have a pending application."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = CreatorApplicationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        app = CreatorApplication.objects.create(user=request.user, **ser.validated_data)
        notify_admins(
            subject=f"[Koleqcia] Creator application from {request.user.email}",
            body=(
                f"User: {request.user.email} ({request.user.name})\n"
                f"Phone: {app.phone}\nEmail: {app.email}\n"
                f"TikTok: {app.tiktok}\nFacebook: {app.facebook}\n"
                f"Instagram: {app.instagram}\nYouTube: {app.youtube}\n"
                f"Application ID: {app.id}"
            ),
        )
        return Response(CreatorApplicationSerializer(app).data, status=status.HTTP_201_CREATED)


class CreatorMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services import list_voucher_redemptions

        pending_app = (
            CreatorApplication.objects.filter(user=request.user)
            .order_by("-created_at")
            .first()
        )
        creator = ContentCreator.objects.filter(user=request.user, is_active=True).first()
        payload = {
            "is_creator": bool(creator),
            "application": CreatorApplicationSerializer(pending_app).data if pending_app else None,
            "creator": ContentCreatorSerializer(creator).data if creator else None,
            "payout_minimum_gel": str(get_payout_minimum_gel()),
            "credit_note": (
                "Earnings are credited in GEL when an order that used your voucher "
                "is marked as paid (status: processing)."
            ),
        }
        if creator:
            ledger = creator.ledger_entries.all()[:50]
            payload["ledger"] = CreatorLedgerEntrySerializer(ledger, many=True).data
            payouts = creator.payout_requests.all()[:20]
            payload["payouts"] = CreatorPayoutRequestSerializer(payouts, many=True).data
            payload["redemptions"] = list_voucher_redemptions(creator.promo, limit=40)
        return Response(payload)


class CreatorPayoutView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        try:
            creator = ContentCreator.objects.select_for_update().get(
                user=request.user, is_active=True
            )
        except ContentCreator.DoesNotExist:
            return Response({"detail": "Not a content creator."}, status=status.HTTP_403_FORBIDDEN)

        if creator.payout_requests.filter(status=CreatorPayoutRequest.STATUS_PENDING).exists():
            return Response(
                {"detail": "You already have a pending payout request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        minimum = get_payout_minimum_gel()
        available = creator.available_balance
        if available < minimum:
            return Response(
                {
                    "detail": f"Minimum payout is {minimum} GEL. Your available balance is {available} GEL.",
                    "available": str(available),
                    "minimum": str(minimum),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = available
        payout = CreatorPayoutRequest.objects.create(
            creator=creator,
            amount=amount,
            currency="GEL",
        )
        CreatorLedgerEntry.objects.create(
            creator=creator,
            entry_type=CreatorLedgerEntry.TYPE_PAYOUT_HOLD,
            amount=amount,
            currency="GEL",
            payout_request=payout,
            note=f"Payout request #{payout.id} hold",
        )
        notify_admins(
            subject=f"[Koleqcia] Creator payout request — {request.user.email}",
            body=(
                f"Creator: {request.user.email}\n"
                f"Amount: {amount} GEL\n"
                f"Payout ID: {payout.id}\n"
                f"Voucher: {creator.promo.code if creator.promo_id else '—'}"
            ),
        )
        return Response(CreatorPayoutRequestSerializer(payout).data, status=status.HTTP_201_CREATED)
