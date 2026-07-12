import os
import random
import uuid
from decimal import Decimal
from django.conf import settings as django_settings
from django.db import transaction
from django.db.models import F
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from .models import Cart, CartItem, Order, OrderItem, OrderStatusHistory, CustomOrder, DeliveryOption, ProcessingOption
from .serializers import (
    CartSerializer,
    AddToCartSerializer,
    OrderSerializer,
    CheckoutSerializer,
    CustomOrderSerializer,
)
from apps.products.models import ProductVariant, SizeVariant


def _resolve_gift_wrap_price(variant, size_variant, currency="USD"):
    """Resolve per-vendor gift wrap price in the requested currency."""
    vendor = None
    if size_variant:
        vendor = getattr(size_variant.product, "vendor", None)
    elif variant:
        vendor = getattr(variant.product, "vendor", None)
    if vendor:
        return Decimal(vendor.gift_wrap_price_gel if currency == "GEL" else vendor.gift_wrap_price_usd)
    try:
        from apps.cms.models import SiteSettings
        setting = SiteSettings.objects.filter(key="gift_wrap_price").first()
        if setting and setting.value:
            return Decimal(setting.value)
    except Exception:
        pass
    return Decimal("0")


class CheckoutThrottle(ScopedRateThrottle):
    scope = "checkout"


class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.prefetch_related(
            "items__variant__product__images",
            "items__variant__size",
            "items__variant__finish",
            "items__variant__frame",
            "items__size_variant__product__images",
        ).get_or_create(user=request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        Cart.objects.filter(user=request.user).update(promo_code=None)
        CartItem.objects.filter(cart__user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant_id = serializer.validated_data.get("variant_id")
        size_variant_id = serializer.validated_data.get("size_variant_id")
        quantity = serializer.validated_data["quantity"]
        gift_wrap = serializer.validated_data.get("gift_wrap", False)
        gift_wrap_note = serializer.validated_data.get("gift_wrap_note", "")
        gift_wrap_image_url = serializer.validated_data.get("gift_wrap_image_url", "")
        delivery_type = serializer.validated_data.get("delivery_type", "standard")
        processing_option = serializer.validated_data.get("processing_option", "")
        currency = serializer.validated_data.get("currency", "USD")

        variant = None
        size_variant = None

        if size_variant_id:
            try:
                size_variant = SizeVariant.objects.select_related("product").get(pk=size_variant_id, is_active=True)
            except SizeVariant.DoesNotExist:
                return Response({"detail": "Size variant not found."}, status=status.HTTP_404_NOT_FOUND)
        elif variant_id:
            try:
                variant = ProductVariant.objects.select_related("product").get(pk=variant_id)
            except ProductVariant.DoesNotExist:
                return Response({"detail": "Variant not found."}, status=status.HTTP_404_NOT_FOUND)
            if variant.stock < quantity:
                return Response({"detail": "Insufficient stock."}, status=status.HTTP_400_BAD_REQUEST)

        gift_wrap_price = _resolve_gift_wrap_price(variant, size_variant, currency) if gift_wrap else Decimal("0")

        cart, _ = Cart.objects.get_or_create(user=request.user)

        defaults = {
            "quantity": quantity,
            "gift_wrap": gift_wrap,
            "gift_wrap_price": gift_wrap_price,
            "gift_wrap_note": gift_wrap_note,
            "gift_wrap_image_url": gift_wrap_image_url,
            "delivery_type": delivery_type,
            "processing_option": processing_option,
        }

        if size_variant:
            item = CartItem.objects.filter(cart=cart, size_variant=size_variant).first()
            if item:
                item.quantity = F("quantity") + quantity
                item.gift_wrap = gift_wrap
                item.gift_wrap_price = gift_wrap_price
                item.gift_wrap_note = gift_wrap_note
                item.gift_wrap_image_url = gift_wrap_image_url
                item.processing_option = processing_option
                item.save(update_fields=["quantity", "gift_wrap", "gift_wrap_price", "gift_wrap_note", "gift_wrap_image_url", "processing_option"])
            else:
                CartItem.objects.create(cart=cart, size_variant=size_variant, **defaults)
        else:
            item = CartItem.objects.filter(cart=cart, variant=variant).first()
            if item:
                item.quantity = F("quantity") + quantity
                item.gift_wrap = gift_wrap
                item.gift_wrap_price = gift_wrap_price
                item.gift_wrap_note = gift_wrap_note
                item.gift_wrap_image_url = gift_wrap_image_url
                item.processing_option = processing_option
                item.save(update_fields=["quantity", "gift_wrap", "gift_wrap_price", "gift_wrap_note", "gift_wrap_image_url", "processing_option"])
            else:
                CartItem.objects.create(cart=cart, variant=variant, **defaults)

        cart.refresh_from_db()
        cart = Cart.objects.prefetch_related(
            "items__variant__product__images",
            "items__variant__size",
            "items__variant__finish",
            "items__variant__frame",
            "items__size_variant__product__images",
        ).get(pk=cart.pk)
        return Response(CartSerializer(cart, context={"request": request}).data, status=status.HTTP_200_OK)

    def patch(self, request, item_id):
        try:
            item = CartItem.objects.get(pk=item_id, cart__user=request.user)
        except CartItem.DoesNotExist:
            return Response({"detail": "Item not found."}, status=status.HTTP_404_NOT_FOUND)

        quantity = request.data.get("quantity")
        if quantity is not None:
            if int(quantity) <= 0:
                item.delete()
            else:
                item.quantity = int(quantity)
                item.save(update_fields=["quantity"])

        cart = Cart.objects.prefetch_related("items__variant__product__images").get(user=request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request, item_id):
        CartItem.objects.filter(pk=item_id, cart__user=request.user).delete()
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)


class PromoApplyView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [type("PromoThrottle", (ScopedRateThrottle,), {"scope": "promo_apply"})]

    def post(self, request):
        from apps.promo.models import PromoCode
        code = request.data.get("code", "").strip().upper()
        if not code:
            return Response({"detail": "Promo code is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            promo = PromoCode.objects.get(code=code)
        except PromoCode.DoesNotExist:
            return Response({"detail": "Invalid or expired promo code."}, status=status.HTTP_400_BAD_REQUEST)

        if not promo.is_active and not promo.user_has_grant(request.user):
            return Response({"detail": "Invalid or expired promo code."}, status=status.HTTP_400_BAD_REQUEST)

        cart, _ = Cart.objects.get_or_create(user=request.user)
        error = promo.validate(request.user, cart.subtotal)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        cart.promo_code = promo
        cart.save(update_fields=["promo_code"])
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        Cart.objects.filter(user=request.user).update(promo_code=None)
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)


class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [CheckoutThrottle]

    @transaction.atomic
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cart = Cart.objects.prefetch_related(
            "items__variant__product__images",
            "items__variant__size",
            "items__variant__finish",
            "items__variant__frame",
            "items__variant__product__artist",
            "items__variant__product__vendor",
        ).filter(user=request.user).first()

        if not cart or not cart.items.exists():
            return Response({"detail": "Cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

        # Atomically lock and deduct stock
        items_to_process = list(cart.items.select_related("variant"))
        variant_ids = [item.variant_id for item in items_to_process]
        locked_variants = {
            v.pk: v for v in ProductVariant.objects.select_for_update().filter(pk__in=variant_ids)
        }

        for item in items_to_process:
            variant = locked_variants[item.variant_id]
            if variant.stock < item.quantity:
                return Response(
                    {"detail": f"'{variant.product.title}' has insufficient stock."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        for item in items_to_process:
            ProductVariant.objects.filter(pk=item.variant_id).update(stock=F("stock") - item.quantity)

        subtotal = cart.subtotal
        discount = Decimal("0")
        promo = cart.promo_code
        if promo:
            from apps.promo.models import PromoCode
            discount = promo.calculate_discount(subtotal)

        # Delivery price
        currency = data.get("currency", "USD")
        req_delivery_type = data.get("delivery_type", "standard")
        delivery_price = Decimal("0")
        try:
            opt = DeliveryOption.objects.filter(slug=req_delivery_type, is_active=True).first()
            if opt:
                delivery_price = Decimal(opt.price_gel) if currency == "GEL" else Decimal(opt.price_usd)
        except Exception:
            pass

        # Gift wrap total
        gift_wrap_total = sum(
            Decimal(item.gift_wrap_price) for item in items_to_process if item.gift_wrap
        )

        total = subtotal - discount + delivery_price + gift_wrap_total

        order = Order.objects.create(
            user=request.user,
            order_number=f"KOL-{2024}-{random.randint(100000, 999999)}",
            shipping_name=data["shipping_name"],
            shipping_line1=data["shipping_line1"],
            shipping_line2=data.get("shipping_line2", ""),
            shipping_city=data["shipping_city"],
            shipping_state=data["shipping_state"],
            shipping_zip=data["shipping_zip"],
            shipping_country=data["shipping_country"],
            shipping_email=data["shipping_email"],
            shipping_phone=data.get("shipping_phone", ""),
            promo_code=promo,
            subtotal=subtotal,
            discount=discount,
            delivery_type=req_delivery_type,
            delivery_price=delivery_price,
            gift_wrap_total=gift_wrap_total,
            currency=currency,
            total=total,
            status="pending",
        )

        for item in items_to_process:
            img = item.variant.product.images.first()
            OrderItem.objects.create(
                order=order,
                vendor=item.variant.product.vendor,
                product_title=item.variant.product.title,
                product_image=img.url if img else "",
                artist_name=item.variant.product.artist.name if item.variant.product.artist else "",
                size_label=item.variant.size.label,
                finish_label=item.variant.finish.label,
                frame_label=item.variant.frame.label,
                price=item.variant.price,
                quantity=item.quantity,
                gift_wrap=item.gift_wrap,
                gift_wrap_note=item.gift_wrap_note,
                gift_wrap_image_url=item.gift_wrap_image_url,
                processing_option=item.processing_option,
            )

        OrderStatusHistory.objects.create(order=order, status="pending", changed_by=request.user)

        try:
            from apps.admin_api.audit import log_action
            log_action(request.user, "order_created", "Order", order.pk, {
                "order_number": order.order_number,
                "total": str(order.total),
                "currency": currency,
                "item_count": len(items_to_process),
            })
        except Exception:
            pass

        if promo:
            from apps.promo.models import PromoCodeUsage
            PromoCodeUsage.objects.create(promo=promo, user=request.user, order=order)

        cart.items.all().delete()
        cart.promo_code = None
        cart.save()

        # Award XP for order placed
        try:
            from apps.gamification.services import award_xp
            award_xp(request.user, "order_placed")
            award_xp(request.user, "first_purchase")
        except Exception:
            pass
        try:
            from apps.referrals.services import process_referral_conversion
            process_referral_conversion(request.user)
        except Exception:
            pass

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related("items", "status_history")


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related("items", "status_history")


class DeliveryOptionListView(APIView):
    """Public endpoint returning active delivery options."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        from .serializers import DeliveryOptionSerializer
        opts = DeliveryOption.objects.filter(is_active=True)
        return Response(DeliveryOptionSerializer(opts, many=True).data)


class ShopSettingsPublicView(APIView):
    """Public endpoint for vendor gift wrap prices and legacy site settings."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        from apps.vendors.models import Vendor
        slug = request.query_params.get("vendor")
        if slug:
            vendor = Vendor.objects.filter(slug=slug).first()
            if vendor:
                return Response({
                    "gift_wrap_price_gel": str(vendor.gift_wrap_price_gel),
                    "gift_wrap_price_usd": str(vendor.gift_wrap_price_usd),
                    "gift_wrap_price": str(vendor.gift_wrap_price_usd),
                })
        try:
            from apps.cms.models import SiteSettings
            setting = SiteSettings.objects.filter(key="gift_wrap_price").first()
            if setting:
                return Response({"gift_wrap_price": setting.value})
        except Exception:
            pass
        return Response({})


class ProcessingOptionListView(APIView):
    """Public endpoint returning active processing time options for a vendor."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        from apps.vendors.models import Vendor
        from .serializers import ProcessingOptionSerializer
        opts = ProcessingOption.objects.filter(is_active=True).select_related("vendor")
        slug = request.query_params.get("vendor")
        if slug:
            vendor = Vendor.objects.filter(slug=slug).first()
            if vendor:
                opts = opts.filter(vendor=vendor)
        return Response(ProcessingOptionSerializer(opts, many=True).data)


class GiftWrapImageUploadView(APIView):
    """Authenticated users can upload a gift wrap / engraving image. Returns a URL."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        import os, uuid
        from django.conf import settings as django_settings
        ext = os.path.splitext(file.name)[1].lower() or ".jpg"
        allowed = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        if ext not in allowed:
            return Response({"detail": "Only image files are allowed."}, status=status.HTTP_400_BAD_REQUEST)
        filename = f"{uuid.uuid4().hex}{ext}"
        save_dir = os.path.join(django_settings.MEDIA_ROOT, "gift_wrap")
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, filename)
        with open(save_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)
        url = request.build_absolute_uri(f"{django_settings.MEDIA_URL}gift_wrap/{filename}")
        return Response({"url": url}, status=status.HTTP_201_CREATED)


class CustomOrderImageUploadView(APIView):
    """Authenticated users upload a reference image for custom orders."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        if not (file.content_type or "").startswith("image/"):
            return Response({"detail": "Only image files are allowed."}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(file.name)[1] or ".jpg"
        filename = f"{uuid.uuid4()}{ext}"
        save_dir = os.path.join(django_settings.MEDIA_ROOT, "custom_orders")
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, filename)
        with open(save_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)
        url = request.build_absolute_uri(f"{django_settings.MEDIA_URL}custom_orders/{filename}")
        return Response({"url": url}, status=status.HTTP_201_CREATED)


class CustomOrderCreateView(generics.CreateAPIView):
    serializer_class = CustomOrderSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        currency = self.request.data.get("currency") or "USD"
        serializer.save(
            user=user,
            name=user.name or serializer.validated_data.get("name", ""),
            email=user.email,
            currency=currency,
        )


class CustomOrderListView(generics.ListAPIView):
    serializer_class = CustomOrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        CustomOrder.objects.filter(email__iexact=user.email, user__isnull=True).update(user=user)
        return CustomOrder.objects.filter(user=user).select_related("vendor").order_by("-created_at")


class CustomOrderDetailView(generics.RetrieveAPIView):
    serializer_class = CustomOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CustomOrder.objects.filter(user=self.request.user).select_related("vendor")
