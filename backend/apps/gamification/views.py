import uuid

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PointTransaction, PointsMarketItem, PointsMarketRedemption, PointsMarketShippingPaymentSession
from .serializers import (
    LoyaltyProfileSerializer,
    PointTransactionSerializer,
    PointsMarketItemSerializer,
    PointsMarketRedemptionSerializer,
    PointsMarketShippingPaymentSessionSerializer,
)
from .services import (
    complete_shipping_payment_session,
    purchase_market_item_idempotent,
    redeem_physical_market_item_idempotent,
)


class LoyaltyProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(LoyaltyProfileSerializer(request.user).data)


class PointTransactionListView(generics.ListAPIView):
    serializer_class = PointTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            PointTransaction.objects.filter(user=self.request.user)
            .select_related("order", "market_item")
            .order_by("-created_at")
        )


class PointsMarketItemListView(generics.ListAPIView):
    serializer_class = PointsMarketItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PointsMarketItem.objects.filter(
            is_active=True,
            stock_quantity__gt=0,
        ).order_by("point_cost", "name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class PointsMarketPurchaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if set(request.data.keys()) != {"item_id"}:
            return Response(
                {"detail": "Only item_id is accepted for points market purchases."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            item_id = int(request.data["item_id"])
        except (TypeError, ValueError):
            return Response({"detail": "item_id must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        raw_key = (request.headers.get("Idempotency-Key") or "").strip()
        if not raw_key:
            return Response({"detail": "Idempotency-Key header is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            idempotency_key = uuid.UUID(raw_key, version=4)
        except (TypeError, ValueError, AttributeError):
            return Response({"detail": "Idempotency-Key must be a UUIDv4 value."}, status=status.HTTP_400_BAD_REQUEST)
        if str(idempotency_key) != raw_key.lower() or idempotency_key.version != 4:
            return Response({"detail": "Idempotency-Key must be a UUIDv4 value."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = purchase_market_item_idempotent(request.user, item_id, idempotency_key)
        except PointsMarketItem.DoesNotExist:
            return Response({"detail": "Reward not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result.response_data, status=status.HTTP_200_OK if result.replayed else status.HTTP_201_CREATED)


class PointsMarketShippingOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.orders.models import DeliveryOption, VendorShippingOption
        from apps.gamification.services import _vendor_allows_self_pickup

        country = (request.query_params.get("country") or "").upper()
        item_id = request.query_params.get("item_id")
        currency = "GEL" if country == "GE" else "USD"
        market = "GE" if country == "GE" else "OTHER"
        item = None
        if item_id:
            item = PointsMarketItem.objects.select_related("vendor__user").filter(pk=item_id).first()

        options = []
        if item and item.vendor_id:
            vendor = item.vendor
            if _vendor_allows_self_pickup(vendor):
                options.append({
                    "slug": "pickup",
                    "label": "I will take it myself",
                    "price": "0.00",
                    "currency": currency,
                    "est_days_min": 0,
                    "est_days_max": 0,
                    "is_pickup": True,
                    "requires_payment": False,
                })
            for opt in VendorShippingOption.objects.filter(vendor=vendor, market=market, is_active=True).order_by("sort_order", "price", "id"):
                options.append({
                    "slug": f"vendor-{opt.id}",
                    "label": opt.label,
                    "price": str(opt.price),
                    "currency": currency,
                    "est_days_min": opt.est_days_min,
                    "est_days_max": opt.est_days_max,
                    "is_pickup": False,
                    "requires_payment": opt.price > 0,
                })
            return Response(options)

        options.append({
            "slug": "pickup",
            "label": "I will take it myself",
            "price": "0.00",
            "currency": currency,
            "est_days_min": 0,
            "est_days_max": 0,
            "is_pickup": True,
            "requires_payment": False,
        })
        for opt in DeliveryOption.objects.filter(is_active=True).order_by("sort_order", "id"):
            price = opt.price_gel if currency == "GEL" else opt.price_usd
            options.append({
                "slug": f"delivery-{opt.id}",
                "label": opt.label,
                "price": str(price),
                "currency": currency,
                "est_days_min": opt.est_days_min,
                "est_days_max": opt.est_days_max,
                "is_pickup": False,
                "requires_payment": price > 0,
            })
        return Response(options)


class PointsMarketPhysicalRedemptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        allowed_keys = {"item_id", "shipping_slug", "address_id", "address", "country"}
        if not set(request.data.keys()).issubset(allowed_keys) or "item_id" not in request.data or "shipping_slug" not in request.data:
            return Response(
                {"detail": "Only item_id, shipping_slug, address_id/address, and country are accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            item_id = int(request.data["item_id"])
        except (TypeError, ValueError):
            return Response({"detail": "item_id must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        raw_key = (request.headers.get("Idempotency-Key") or "").strip()
        if not raw_key:
            return Response({"detail": "Idempotency-Key header is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            idempotency_key = uuid.UUID(raw_key, version=4)
        except (TypeError, ValueError, AttributeError):
            return Response({"detail": "Idempotency-Key must be a UUIDv4 value."}, status=status.HTTP_400_BAD_REQUEST)
        if str(idempotency_key) != raw_key.lower() or idempotency_key.version != 4:
            return Response({"detail": "Idempotency-Key must be a UUIDv4 value."}, status=status.HTTP_400_BAD_REQUEST)

        address_id = request.data.get("address_id")
        if address_id in ("", None):
            address_id = None
        try:
            result = redeem_physical_market_item_idempotent(
                request.user,
                item_id,
                idempotency_key,
                shipping_slug=str(request.data.get("shipping_slug") or ""),
                address_id=address_id,
                address_data=request.data.get("address"),
                country=str(request.data.get("country") or ""),
            )
        except PointsMarketItem.DoesNotExist:
            return Response({"detail": "Reward not found."}, status=status.HTTP_404_NOT_FOUND)
        except ObjectDoesNotExist:
            return Response({"detail": "Selected address or shipping option was not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result.response_data, status=status.HTTP_200_OK if result.replayed else status.HTTP_201_CREATED)


class PointsMarketRedemptionListView(generics.ListAPIView):
    serializer_class = PointsMarketRedemptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            PointsMarketRedemption.objects.filter(user=self.request.user)
            .select_related("user", "market_item", "transaction")
            .order_by("-created_at")
        )


class PointsMarketShippingPaymentSessionView(generics.RetrieveAPIView):
    serializer_class = PointsMarketShippingPaymentSessionSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "token"
    lookup_url_kwarg = "token"

    def get_queryset(self):
        return PointsMarketShippingPaymentSession.objects.filter(user=self.request.user).select_related("market_item", "redemption")


class PointsMarketShippingPaymentCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        try:
            token_value = uuid.UUID(str(token), version=4)
        except (TypeError, ValueError, AttributeError):
            return Response({"detail": "Invalid payment session."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = complete_shipping_payment_session(request.user, token_value)
        except PointsMarketShippingPaymentSession.DoesNotExist:
            return Response({"detail": "Payment session not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)
