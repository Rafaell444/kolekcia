import os
import random
import uuid
import hashlib
import json
from decimal import Decimal
from django.conf import settings as django_settings
from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from .models import Cart, CartItem, Order, OrderItem, OrderShipment, OrderStatusHistory, CustomOrder, DeliveryOption, PaymentSession, ProcessingOption, VendorShippingOption
from .pricing import (
    normalize_currency,
    resolve_gift_wrap_price,
    resolve_processing,
    resolve_unit_price,
)
from .serializers import (
    CartSerializer,
    AddToCartSerializer,
    OrderSerializer,
    CheckoutSerializer,
    CustomOrderSerializer,
)
from apps.products.models import ProductVariant, SizeVariant
from .inventory import (
    InsufficientInventoryError,
    available_quantity,
    finalize_order_stock,
    release_order_stock,
    reserve_order_stock,
)


def _absolute_product_image(url: str, request=None) -> str:
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if request is not None:
        try:
            return request.build_absolute_uri(url)
        except Exception:
            pass
    from django.conf import settings as s
    base = getattr(s, "BACKEND_PUBLIC_URL", "") or ""
    if base and url.startswith("/"):
        return base.rstrip("/") + url
    return url


# Back-compat aliases used elsewhere in this module
_resolve_gift_wrap_price = resolve_gift_wrap_price
_resolve_processing = resolve_processing
_resolve_unit_price = resolve_unit_price
_normalize_currency = normalize_currency


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

    @transaction.atomic
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
                size_variant = SizeVariant.objects.select_for_update().select_related("product").get(pk=size_variant_id, is_active=True)
            except SizeVariant.DoesNotExist:
                return Response({"detail": "Size variant not found."}, status=status.HTTP_404_NOT_FOUND)
            available = available_quantity(size_variant)
            is_made_to_order = bool(processing_option)
            if available is not None and available < quantity and not is_made_to_order:
                return Response({"detail": "Insufficient stock."}, status=status.HTTP_400_BAD_REQUEST)
        elif variant_id:
            try:
                variant = ProductVariant.objects.select_for_update().select_related("product").get(pk=variant_id)
            except ProductVariant.DoesNotExist:
                return Response({"detail": "Variant not found."}, status=status.HTTP_404_NOT_FOUND)
            if available_quantity(variant) < quantity:
                return Response({"detail": "Insufficient stock."}, status=status.HTTP_400_BAD_REQUEST)

        currency = _normalize_currency(currency)
        unit_price = _resolve_unit_price(variant, size_variant, currency)
        gift_wrap_price = _resolve_gift_wrap_price(variant, size_variant, currency) if gift_wrap else Decimal("0")
        product = size_variant.product if size_variant else variant.product
        if processing_option and not product.processing_options.filter(slug=processing_option, is_active=True).exists():
            return Response(
                {"detail": "The selected processing option is not available for this product."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        processing_fee, processing_label, processing_days = _resolve_processing(
            variant, size_variant, processing_option, currency
        )

        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart = Cart.objects.select_for_update().get(pk=cart.pk)

        defaults = {
            "quantity": quantity,
            "unit_price": unit_price,
            "currency": currency,
            "gift_wrap": gift_wrap,
            "gift_wrap_price": gift_wrap_price,
            "gift_wrap_note": gift_wrap_note,
            "gift_wrap_image_url": gift_wrap_image_url,
            "delivery_type": delivery_type,
            "processing_option": processing_option,
            "processing_fee": processing_fee,
            "processing_label": processing_label,
            "processing_days": processing_days,
        }

        update_fields = [
            "quantity", "unit_price", "currency",
            "gift_wrap", "gift_wrap_price", "gift_wrap_note", "gift_wrap_image_url",
            "processing_option", "processing_fee", "processing_label", "processing_days",
        ]

        if size_variant:
            item = CartItem.objects.select_for_update().filter(cart=cart, size_variant=size_variant).first()
            if item:
                new_quantity = item.quantity + quantity
                available = available_quantity(size_variant)
                is_made_to_order = bool(processing_option or item.processing_option)
                if available is not None and new_quantity > available and not is_made_to_order:
                    return Response(
                        {"detail": f"Only {available} item(s) available. You already have {item.quantity} in your cart."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                item.quantity = new_quantity
                item.unit_price = unit_price
                item.currency = currency
                item.gift_wrap = gift_wrap
                item.gift_wrap_price = gift_wrap_price
                item.gift_wrap_note = gift_wrap_note
                item.gift_wrap_image_url = gift_wrap_image_url
                item.processing_option = processing_option
                item.processing_fee = processing_fee
                item.processing_label = processing_label
                item.processing_days = processing_days
                item.save(update_fields=update_fields)
            else:
                CartItem.objects.create(cart=cart, size_variant=size_variant, **defaults)
        else:
            item = CartItem.objects.select_for_update().filter(cart=cart, variant=variant).first()
            if item:
                new_quantity = item.quantity + quantity
                available = available_quantity(variant)
                if new_quantity > available:
                    return Response(
                        {"detail": f"Only {available} item(s) available. You already have {item.quantity} in your cart."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                item.quantity = new_quantity
                item.unit_price = unit_price
                item.currency = currency
                item.gift_wrap = gift_wrap
                item.gift_wrap_price = gift_wrap_price
                item.gift_wrap_note = gift_wrap_note
                item.gift_wrap_image_url = gift_wrap_image_url
                item.processing_option = processing_option
                item.processing_fee = processing_fee
                item.processing_label = processing_label
                item.processing_days = processing_days
                item.save(update_fields=update_fields)
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

    @transaction.atomic
    def patch(self, request, item_id):
        try:
            item = CartItem.objects.select_for_update().select_related("size_variant", "variant").get(pk=item_id, cart__user=request.user)
        except CartItem.DoesNotExist:
            return Response({"detail": "Item not found."}, status=status.HTTP_404_NOT_FOUND)

        quantity = request.data.get("quantity")
        if quantity is not None:
            try:
                requested_quantity = int(quantity)
            except (TypeError, ValueError):
                return Response({"detail": "Quantity must be a whole number."}, status=status.HTTP_400_BAD_REQUEST)
            if requested_quantity <= 0:
                item.delete()
            else:
                target = item.size_variant if item.size_variant_id else item.variant
                available = available_quantity(target)
                if available is not None and requested_quantity > available:
                    return Response(
                        {"detail": f"Only {available} item(s) available."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                item.quantity = requested_quantity
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
        from apps.creators.services import product_subtotal_from_cart

        code = request.data.get("code", "").strip()
        if not code:
            return Response({"detail": "Promo code is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            promo = PromoCode.objects.get(code__iexact=code)
        except PromoCode.DoesNotExist:
            return Response({"detail": "Invalid or expired promo code."}, status=status.HTTP_400_BAD_REQUEST)

        if not promo.is_active and not promo.user_has_grant(request.user):
            return Response({"detail": "Invalid or expired promo code."}, status=status.HTTP_400_BAD_REQUEST)

        # Creator vouchers: owner cannot use their own code
        if promo.owner_id and promo.owner_id == request.user.id:
            return Response(
                {"detail": "You cannot use your own creator voucher."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart, _ = Cart.objects.get_or_create(user=request.user)
        # Only one voucher at a time — applying replaces any existing code
        validate_base = (
            product_subtotal_from_cart(cart) if promo.owner_id else cart.subtotal
        )
        error = promo.validate(request.user, validate_base)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        if promo.is_scoped:
            has_match = False
            for item in cart.items.select_related(
                "variant__product", "size_variant__product"
            ):
                product = (
                    item.size_variant.product if item.size_variant_id
                    else item.variant.product if item.variant_id
                    else None
                )
                if product and promo.applies_to_item(product):
                    has_match = True
                    break
            if not has_match:
                scoped_names = []
                prod_names = list(promo.products.values_list("title", flat=True)[:5])
                cat_names = list(promo.categories.values_list("name", flat=True)[:5])
                if prod_names:
                    scoped_names.append(", ".join(prod_names))
                if cat_names:
                    scoped_names.append(", ".join(cat_names))
                hint = " or ".join(scoped_names) if scoped_names else "specific products"
                return Response(
                    {"detail": f"This promo code only applies to: {hint}. Add qualifying items to your cart."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        cart.promo_code = promo
        cart.save(update_fields=["promo_code"])
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        Cart.objects.filter(user=request.user).update(promo_code=None)
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartRepriceView(APIView):
    """
    Re-resolve all cart item prices for a market currency using admin-written
    regional prices (no FX). Used when checkout shipping country switches market.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        currency = _normalize_currency(request.data.get("currency", "USD"))
        cart, _ = Cart.objects.prefetch_related(
            "items__variant__product",
            "items__size_variant__product",
        ).get_or_create(user=request.user)

        for item in cart.items.select_related(
            "variant__product__vendor",
            "size_variant__product__vendor",
        ):
            unit_price = _resolve_unit_price(item.variant, item.size_variant, currency)
            wrap = (
                _resolve_gift_wrap_price(item.variant, item.size_variant, currency)
                if item.gift_wrap else Decimal("0")
            )
            proc_fee, proc_label, proc_days = _resolve_processing(
                item.variant, item.size_variant, item.processing_option or "", currency
            )
            if not item.processing_option:
                proc_fee, proc_label, proc_days = Decimal("0"), "", ""
            item.unit_price = unit_price
            item.currency = currency
            item.gift_wrap_price = wrap
            item.processing_fee = proc_fee
            if proc_label:
                item.processing_label = proc_label
            if proc_days:
                item.processing_days = proc_days
            item.save(update_fields=[
                "unit_price", "currency", "gift_wrap_price",
                "processing_fee", "processing_label", "processing_days",
            ])

        cart = Cart.objects.prefetch_related(
            "items__variant__product__images",
            "items__variant__size",
            "items__variant__finish",
            "items__variant__frame",
            "items__size_variant__product__images",
        ).get(pk=cart.pk)
        return Response(CartSerializer(cart, context={"request": request}).data)


def _vendor_allows_self_pickup(vendor) -> bool:
    if not vendor:
        return False
    return not (
        vendor.slug in ("sculpi", "figure-studio")
        or vendor.catalog_category_slug == "figures"
        or getattr(vendor.user, "email", "") == "vendor2@kolekcia.com"
    )


def _payment_response(payment: PaymentSession, order: Order) -> Response:
    return Response(
        {
            "payment_required": True,
            "provider": payment.provider,
            "payment_id": str(payment.id),
            "payment_url": payment.payment_url,
            "integrator_order_id": str(payment.integrator_order_id),
            "order": OrderSerializer(order).data,
        },
        status=status.HTTP_201_CREATED,
    )


def _finalize_paid_order(order: Order, payment: PaymentSession | None = None) -> None:
    if order.status == "processing":
        return
    finalize_order_stock(order)
    order.status = "processing"
    order.save(update_fields=["status"])
    OrderStatusHistory.objects.create(
        order=order,
        status="processing",
        note="Payment successful — order is being processed.",
        changed_by=order.user,
    )
    try:
        from apps.creators.services import credit_creator_for_paid_order
        credit_creator_for_paid_order(order)
    except Exception:
        pass
    if order.promo_code_id and order.user_id:
        from apps.promo.models import PromoCodeUsage
        PromoCodeUsage.objects.get_or_create(promo=order.promo_code, user=order.user, order=order)
    try:
        from apps.gamification.services import create_pending_purchase_points
        create_pending_purchase_points(order)
    except Exception:
        pass
    try:
        from apps.referrals.services import process_referral_conversion
        process_referral_conversion(order.user)
    except Exception:
        pass
    try:
        from apps.emails.service import send_template_email, get_template
        from apps.emails.order_context import build_order_email_context
        first_item = order.items.select_related("vendor").first()
        vendor_obj = first_item.vendor if first_item else None
        if get_template("order_confirmed", vendor=vendor_obj):
            send_template_email(
                "order_confirmed",
                order.shipping_email,
                build_order_email_context(order),
                vendor=vendor_obj,
            )
    except Exception:
        pass


def _mark_order_payment_failed(order: Order, note: str = "Payment failed or was cancelled.") -> None:
    if order.status in ("processing", "shipped", "delivered", "refunded", "payment_failed", "cancelled"):
        return
    release_order_stock(order)
    order.status = "payment_failed"
    order.save(update_fields=["status"])
    OrderStatusHistory.objects.create(order=order, status="payment_failed", note=note, changed_by=order.user)


class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [CheckoutThrottle]

    @transaction.atomic
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        idempotency_key = (request.headers.get("Idempotency-Key") or "").strip()
        if idempotency_key and (len(idempotency_key) > 64 or not all(c.isalnum() or c in "-_" for c in idempotency_key)):
            return Response({"detail": "Invalid checkout idempotency key."}, status=status.HTTP_400_BAD_REQUEST)
        request_fingerprint = hashlib.sha256(
            json.dumps(data, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()
        if idempotency_key:
            existing_order = Order.objects.filter(
                user=request.user,
                checkout_idempotency_key=idempotency_key,
            ).first()
            if existing_order:
                if existing_order.checkout_request_fingerprint != request_fingerprint:
                    return Response(
                        {"detail": "This checkout key was already used with different order details."},
                        status=status.HTTP_409_CONFLICT,
                    )
                if django_settings.KEEPZ_ENABLED and existing_order.status == "pending_payment":
                    existing_payment = existing_order.payment_sessions.filter(
                        provider=PaymentSession.PROVIDER_KEEPZ,
                        status__in=(PaymentSession.STATUS_CREATED, PaymentSession.STATUS_REDIRECTED),
                    ).order_by("-created_at").first()
                    if existing_payment and existing_payment.payment_url:
                        return _payment_response(existing_payment, existing_order)
                return Response(OrderSerializer(existing_order).data, status=status.HTTP_200_OK)

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
        items_to_process = list(
            cart.items.select_related(
                "variant__product__artist",
                "variant__product__vendor",
                "variant__size",
                "variant__finish",
                "variant__frame",
                "size_variant__product__artist",
                "size_variant__product__vendor",
            ).prefetch_related(
                "variant__product__images",
                "size_variant__product__images",
                "size_variant__images",
            )
        )
        variant_ids = [item.variant_id for item in items_to_process if item.variant_id]
        size_variant_ids = [item.size_variant_id for item in items_to_process if item.size_variant_id]
        locked_variants = {
            v.pk: v for v in ProductVariant.objects.select_for_update().filter(pk__in=variant_ids)
        }
        locked_size_variants = {
            sv.pk: sv for sv in SizeVariant.objects.select_for_update().select_related("product").filter(pk__in=size_variant_ids)
        }

        for item in items_to_process:
            if item.variant_id:
                variant = locked_variants.get(item.variant_id)
                available = available_quantity(variant) if variant else None
                if variant and available is not None and available < item.quantity:
                    return Response(
                        {"detail": f"'{variant.product.title}' has insufficient stock."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            elif item.size_variant_id:
                sv = locked_size_variants.get(item.size_variant_id)
                available = available_quantity(sv) if sv else None
                is_made_to_order = bool(item.processing_option)
                if sv and available is not None and available < item.quantity and not is_made_to_order:
                    return Response(
                        {"detail": f"'{sv.product.title}' has insufficient stock."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        # Resolve all money in checkout currency (admin market prices, no FX)
        currency = _normalize_currency(data.get("currency", "USD"))
        req_delivery_type = data.get("delivery_type", "standard")
        shipping_selections = data.get("shipping_selections", {})

        # Build vendor → items mapping for per-vendor shipping
        vendor_item_map: dict[int | None, list] = {}
        for item in items_to_process:
            vid = (
                item.size_variant.product.vendor_id if item.size_variant_id
                else item.variant.product.vendor_id if item.variant_id
                else None
            )
            vendor_item_map.setdefault(vid, []).append(item)

        market = "GE" if currency == "GEL" else "OTHER"
        # Resolve shipping: per-vendor selections take priority
        shipment_specs: list[dict] = []  # vendor_id, option, items
        delivery_price = Decimal("0")

        if shipping_selections:
            # Per-vendor shipping mode
            for vendor_id_str, option_slug in shipping_selections.items():
                try:
                    vendor_id = int(vendor_id_str)
                except (TypeError, ValueError):
                    return Response({"detail": f"Invalid vendor ID: {vendor_id_str}"}, status=status.HTTP_400_BAD_REQUEST)

                if vendor_id not in vendor_item_map:
                    return Response({"detail": "Invalid vendor shipping selection."}, status=status.HTTP_400_BAD_REQUEST)

                if option_slug == f"pickup-{vendor_id}":
                    from apps.vendors.models import Vendor

                    pickup_vendor = Vendor.objects.select_related("user").filter(pk=vendor_id).first()
                    if not _vendor_allows_self_pickup(pickup_vendor):
                        return Response(
                            {"detail": "Self-pickup is not available for this vendor."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    shipment_specs.append({
                        "vendor_id": vendor_id,
                        "option": None,
                        "delivery_type": "self-pickup",
                        "delivery_label": "I will take it myself",
                        "delivery_price": Decimal("0"),
                        "items": vendor_item_map.get(vendor_id, []),
                    })
                    continue

                if not option_slug.startswith("vendor-"):
                    return Response({"detail": f"Invalid shipping option: {option_slug}"}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    option_id = int(option_slug.replace("vendor-", "", 1))
                except (TypeError, ValueError):
                    return Response({"detail": f"Invalid shipping option: {option_slug}"}, status=status.HTTP_400_BAD_REQUEST)

                opt = VendorShippingOption.objects.filter(
                    pk=option_id, vendor_id=vendor_id, market=market, is_active=True,
                ).select_related("vendor").first()
                if not opt:
                    return Response({"detail": "The selected shipping option is not available."}, status=status.HTTP_400_BAD_REQUEST)

                shipment_specs.append({
                    "vendor_id": vendor_id,
                    "option": opt,
                    "delivery_type": f"vendor-{opt.pk}",
                    "delivery_label": opt.label,
                    "delivery_price": Decimal(opt.price),
                    "items": vendor_item_map.get(vendor_id, []),
                })
                delivery_price += Decimal(opt.price)

            # Assign any remaining vendor items without explicit selection
            assigned_vendors = {s["vendor_id"] for s in shipment_specs}
            for vid, vitems in vendor_item_map.items():
                if vid is not None and vid not in assigned_vendors:
                    return Response(
                        {"detail": "Missing shipping selection for one or more vendors."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            req_delivery_type = "per-vendor"
        elif req_delivery_type.startswith("vendor-"):
            # Single vendor shipping (backward compat)
            try:
                shipping_option_id = int(req_delivery_type.replace("vendor-", "", 1))
            except (TypeError, ValueError):
                return Response({"detail": "Invalid shipping option."}, status=status.HTTP_400_BAD_REQUEST)

            cart_vendor_ids = {vid for vid in vendor_item_map if vid is not None}
            opt = VendorShippingOption.objects.filter(
                pk=shipping_option_id, vendor_id__in=cart_vendor_ids, market=market, is_active=True,
            ).select_related("vendor").first()
            if not opt:
                return Response({"detail": "The selected shipping option is not available for this order."}, status=status.HTTP_400_BAD_REQUEST)
            delivery_price = Decimal(opt.price)
            # Create a single shipment for backward compat
            shipment_specs.append({
                "vendor_id": opt.vendor_id,
                "option": opt,
                "delivery_type": f"vendor-{opt.pk}",
                "delivery_label": opt.label,
                "delivery_price": Decimal(opt.price),
                "items": items_to_process,
            })
        else:
            try:
                opt = DeliveryOption.objects.filter(slug=req_delivery_type, is_active=True).first()
                if opt:
                    delivery_price = Decimal(opt.price_gel) if currency == "GEL" else Decimal(opt.price_usd)
            except Exception:
                pass

        # Build priced lines (re-resolve unit / wrap / processing for checkout currency)
        priced_lines = []
        product_subtotal = Decimal("0")
        gift_wrap_total = Decimal("0")
        processing_fee_total = Decimal("0")
        for item in items_to_process:
            unit_price = _resolve_unit_price(item.variant, item.size_variant, currency)
            wrap = (
                _resolve_gift_wrap_price(item.variant, item.size_variant, currency)
                if item.gift_wrap else Decimal("0")
            )
            proc_fee, proc_label, proc_days = _resolve_processing(
                item.variant, item.size_variant, item.processing_option or "", currency
            )
            if not item.processing_option:
                proc_fee, proc_label, proc_days = Decimal("0"), "", ""
            product_subtotal += unit_price * item.quantity
            gift_wrap_total += wrap
            processing_fee_total += proc_fee
            product = (
                item.size_variant.product if item.size_variant_id
                else item.variant.product if item.variant_id
                else None
            )
            priced_lines.append({
                "item": item,
                "product": product,
                "is_sale": False,
                "unit_price": unit_price,
                "product_subtotal": unit_price * item.quantity,
                "wrap": wrap,
                "proc_fee": proc_fee,
                "proc_label": proc_label or item.processing_label,
                "proc_days": proc_days or item.processing_days,
            })

        promo = cart.promo_code

        from apps.gamification.services import (
            CheckoutDiscountCalculator,
            calculate_tier_eligible_subtotal,
            calculate_voucher_discount_for_lines,
            is_sale_product_line,
        )

        discount_base = product_subtotal + gift_wrap_total + processing_fee_total
        tier_lines = []
        for line in priced_lines:
            item = line["item"]
            product = line["product"]
            if product:
                is_sale = is_sale_product_line(product, item.variant, item.size_variant, item.currency)
                line["is_sale"] = is_sale
                tier_lines.append((product, line["unit_price"] * item.quantity, is_sale))
        voucher_discount = calculate_voucher_discount_for_lines(promo, tier_lines)
        tier_eligible_subtotal, tier_info = calculate_tier_eligible_subtotal(request.user, tier_lines)
        discount_decision = CheckoutDiscountCalculator(
            request.user,
            discount_base,
            promo=promo,
            voucher_discount=voucher_discount,
            tier_eligible_subtotal=tier_eligible_subtotal,
            tier_info=tier_info,
        ).evaluate()
        discount = discount_decision.discount

        from .allocations import allocate_checkout_discounts

        line_discounts = allocate_checkout_discounts(
            priced_lines,
            promo,
            discount_decision.tier_discount,
            discount_decision.voucher_discount,
        )
        for line, allocation in zip(priced_lines, line_discounts):
            line.update(allocation)

        # subtotal = products only; extras + shipping listed separately
        total = product_subtotal + gift_wrap_total + processing_fee_total - discount + delivery_price

        payment_required = bool(django_settings.KEEPZ_ENABLED)
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
            subtotal=product_subtotal,
            discount=discount,
            delivery_type=req_delivery_type,
            delivery_price=delivery_price,
            gift_wrap_total=gift_wrap_total,
            processing_fee_total=processing_fee_total,
            currency=currency,
            total=total,
            status="pending_payment" if payment_required else "processing",
            checkout_idempotency_key=idempotency_key or None,
            checkout_request_fingerprint=request_fingerprint if idempotency_key else "",
        )

        # Create per-vendor shipments
        shipment_map: dict[int | None, OrderShipment] = {}
        for spec in shipment_specs:
            shipment = OrderShipment.objects.create(
                order=order,
                vendor_id=spec["vendor_id"],
                delivery_type=spec["delivery_type"],
                delivery_label=spec["delivery_label"],
                delivery_price=spec["delivery_price"],
                status="processing",
            )
            shipment_map[spec["vendor_id"]] = shipment

        # Build cart_item → shipment lookup
        def _get_shipment_for_item(cart_item):
            vid = (
                cart_item.size_variant.product.vendor_id if cart_item.size_variant_id
                else cart_item.variant.product.vendor_id if cart_item.variant_id
                else None
            )
            return shipment_map.get(vid)

        for line in priced_lines:
            item = line["item"]
            item_shipment = _get_shipment_for_item(item)
            if item.size_variant_id:
                sv = item.size_variant
                product = sv.product
                img = product.images.first()
                sv_img = sv.images.first() if hasattr(sv, "images") else None
                image_url = ""
                if sv_img:
                    image_url = sv_img.url or (sv_img.video_file.url if sv_img.video_file else "")
                elif img:
                    image_url = img.url or (img.video_file.url if getattr(img, "video_file", None) else "")
                OrderItem.objects.create(
                    order=order,
                    vendor=product.vendor,
                    shipment=item_shipment,
                    size_variant=sv,
                    product_title=product.title,
                    product_image=_absolute_product_image(image_url, request),
                    artist_name=product.artist.name if product.artist else "",
                    size_label=sv.label,
                    finish_label="",
                    frame_label="",
                    price=line["unit_price"],
                    quantity=item.quantity,
                    gift_wrap=item.gift_wrap,
                    gift_wrap_price=line["wrap"],
                    gift_wrap_note=item.gift_wrap_note,
                    gift_wrap_image_url=_absolute_product_image(item.gift_wrap_image_url, request),
                    processing_option=item.processing_option,
                    processing_fee=line["proc_fee"],
                    tier_discount=line["tier_discount"],
                    voucher_discount=line["voucher_discount"],
                    processing_label=line["proc_label"],
                    processing_days=line["proc_days"],
                )

            elif item.variant_id:
                variant = item.variant
                img = variant.product.images.first()
                image_url = ""
                if img:
                    image_url = img.url or (img.video_file.url if getattr(img, "video_file", None) else "")
                OrderItem.objects.create(
                    order=order,
                    vendor=variant.product.vendor,
                    shipment=item_shipment,
                    variant=variant,
                    product_title=variant.product.title,
                    product_image=_absolute_product_image(image_url, request),
                    artist_name=variant.product.artist.name if variant.product.artist else "",
                    size_label=variant.size.label,
                    finish_label=variant.finish.label,
                    frame_label=variant.frame.label,
                    price=line["unit_price"],
                    quantity=item.quantity,
                    gift_wrap=item.gift_wrap,
                    gift_wrap_price=line["wrap"],
                    gift_wrap_note=item.gift_wrap_note,
                    gift_wrap_image_url=_absolute_product_image(item.gift_wrap_image_url, request),
                    processing_option=item.processing_option,
                    processing_fee=line["proc_fee"],
                    tier_discount=line["tier_discount"],
                    voucher_discount=line["voucher_discount"],
                    processing_label=line["proc_label"],
                    processing_days=line["proc_days"],
                )

        try:
            reserve_order_stock(order)
        except InsufficientInventoryError as exc:
            transaction.set_rollback(True)
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            note="Payment is pending — customer redirected to Keepz." if payment_required else "Payment successful — order is being processed.",
            changed_by=request.user,
        )

        if payment_required:
            from .keepz import KeepzGatewayError, create_keepz_order_for_checkout
            payment = PaymentSession.objects.create(
                provider=PaymentSession.PROVIDER_KEEPZ,
                purpose=PaymentSession.PURPOSE_CHECKOUT,
                status=PaymentSession.STATUS_CREATED,
                user=request.user,
                order=order,
                amount=total,
                currency=currency,
            )
            try:
                keepz_result = create_keepz_order_for_checkout(payment, request=request)
            except KeepzGatewayError as exc:
                payment.status = PaymentSession.STATUS_FAILED
                payment.last_error = str(exc)
                payment.response_payload = exc.payload
                payment.save(update_fields=["status", "last_error", "response_payload", "updated_at"])
                provider_detail = (
                    exc.payload.get("message")
                    or exc.payload.get("error")
                    or exc.payload.get("detail")
                    or str(exc)
                )
                # The checkout view is atomic. A rejected provider order must
                # not consume stock, clear the cart, or leave a pending order.
                transaction.set_rollback(True)
                return Response(
                    {
                        "detail": f"Payment gateway rejected the order: {provider_detail}",
                        "provider_detail": provider_detail,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            except Exception as exc:
                payment.status = PaymentSession.STATUS_FAILED
                payment.last_error = str(exc)
                payment.save(update_fields=["status", "last_error", "updated_at"])
                raise
            payment.payment_url = keepz_result.payment_url
            payment.request_payload = keepz_result.request_payload
            payment.response_payload = keepz_result.provider_payload
            payment.status = PaymentSession.STATUS_REDIRECTED
            payment.save(update_fields=["payment_url", "request_payload", "response_payload", "status", "updated_at"])
        else:
            finalize_order_stock(order)
            # Creator voucher earnings credit on paid checkout
            try:
                from apps.creators.services import credit_creator_for_paid_order
                credit_creator_for_paid_order(order)
            except Exception:
                pass

        try:
            from apps.admin_api.audit import log_action
            log_action(request.user, "order_created", "Order", order.pk, {
                "order_number": order.order_number,
                "total": str(order.total),
                "currency": currency,
                "item_count": len(items_to_process),
                "status": order.status,
            })
        except Exception:
            pass

        if promo and not payment_required:
            from apps.promo.models import PromoCodeUsage
            PromoCodeUsage.objects.create(promo=promo, user=request.user, order=order)

        cart.items.all().delete()
        cart.promo_code = None
        cart.save()

        if not payment_required:
            # Loyalty points are earned as pending until shipment.
            try:
                from apps.gamification.services import create_pending_purchase_points
                create_pending_purchase_points(order)
            except Exception:
                pass
            try:
                from apps.referrals.services import process_referral_conversion
                process_referral_conversion(request.user)
            except Exception:
                pass

            # Branded order confirmation email
            try:
                from apps.emails.service import send_template_email, get_template
                from apps.emails.order_context import build_order_email_context
                vendor = order.items.select_related("vendor").first()
                vendor_obj = vendor.vendor if vendor else None
                if get_template("order_confirmed", vendor=vendor_obj):
                    send_template_email(
                        "order_confirmed",
                        order.shipping_email,
                        build_order_email_context(order),
                        vendor=vendor_obj,
                    )
            except Exception:
                pass

        if payment_required:
            return _payment_response(payment, order)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .exclude(status__in=("pending_payment", "payment_failed"))
            .prefetch_related("items__vendor", "shipments__vendor", "status_history")
        )


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .exclude(status__in=("pending_payment", "payment_failed"))
            .prefetch_related("items__vendor", "shipments__vendor", "status_history")
        )


class KeepzCallbackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        integrator_order_id = request.data.get("integratorOrderId")
        integrator_id = request.data.get("integratorId")
        if not integrator_order_id:
            return Response({"detail": "integratorOrderId is required."}, status=status.HTTP_400_BAD_REQUEST)
        if integrator_id and str(integrator_id) != str(django_settings.KEEPZ_INTEGRATOR_ID):
            return Response({"detail": "Invalid integratorId."}, status=status.HTTP_400_BAD_REQUEST)

        payment = (
            PaymentSession.objects
            .filter(provider=PaymentSession.PROVIDER_KEEPZ, integrator_order_id=integrator_order_id)
            .first()
        )
        if not payment:
            return Response({"detail": "Payment session not found."}, status=status.HTTP_404_NOT_FOUND)

        callback_amount = request.data.get("amount")
        if callback_amount is not None:
            try:
                if Decimal(str(callback_amount)).quantize(Decimal("0.01")) != payment.amount:
                    return Response({"detail": "Callback amount mismatch."}, status=status.HTTP_400_BAD_REQUEST)
            except (ArithmeticError, ValueError):
                return Response({"detail": "Invalid callback amount."}, status=status.HTTP_400_BAD_REQUEST)
        callback_currency = str(request.data.get("initialCurrency") or "").upper()
        if callback_currency and callback_currency != payment.currency.upper():
            return Response({"detail": "Callback currency mismatch."}, status=status.HTTP_400_BAD_REQUEST)

        # Keepz callbacks are not signed. Verify every terminal update against
        # Keepz's encrypted status endpoint before changing local payment state.
        from .keepz import KeepzGatewayError, get_keepz_order_status
        try:
            provider_status = get_keepz_order_status(str(payment.integrator_order_id))
        except KeepzGatewayError:
            return Response(
                {"detail": "Could not verify payment status with Keepz."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if str(provider_status.get("integratorOrderId") or "") != str(payment.integrator_order_id):
            return Response({"detail": "Keepz status identifier mismatch."}, status=status.HTTP_400_BAD_REQUEST)

        keepz_status = str(provider_status.get("status") or "").upper()
        terminal_failed_statuses = {"FAILED", "CANCELED", "EXPIRED"}

        with transaction.atomic():
            payment = (
                PaymentSession.objects.select_for_update()
                .select_related("order", "user")
                .get(pk=payment.pk)
            )
            payment.callback_payload = request.data
            payment.response_payload = {
                **(payment.response_payload or {}),
                "verified_status": provider_status,
            }
            transaction_id = provider_status.get("transactionId") or request.data.get("transactionId")
            if transaction_id:
                payment.provider_transaction_id = str(transaction_id)

            if keepz_status == "SUCCESS":
                from django.utils import timezone
                payment.status = PaymentSession.STATUS_SUCCESS
                payment.paid_at = payment.paid_at or timezone.now()
                payment.save(update_fields=[
                    "status", "paid_at", "provider_transaction_id", "callback_payload",
                    "response_payload", "updated_at",
                ])
                if payment.order_id:
                    _finalize_paid_order(payment.order, payment)
                elif payment.purpose == PaymentSession.PURPOSE_POINTS_SHIPPING and payment.related_id:
                    from apps.gamification.services import complete_shipping_payment_session
                    complete_shipping_payment_session(payment.user, payment.related_id)
                elif payment.purpose == PaymentSession.PURPOSE_CUSTOM_ORDER and payment.related_id:
                    custom_order = CustomOrder.objects.select_for_update().filter(pk=payment.related_id).first()
                    if custom_order:
                        custom_order.status = "paid"
                        custom_order.paid_at = payment.paid_at
                        custom_order.payment_url = ""
                        custom_order.save(update_fields=["status", "paid_at", "payment_url"])
                elif payment.purpose == PaymentSession.PURPOSE_AUCTION and payment.related_id:
                    from apps.auctions.models import Auction

                    auction = Auction.objects.select_for_update().filter(pk=payment.related_id).first()
                    if auction:
                        auction.winner_payment_status = Auction.PAYMENT_PAID
                        auction.status = Auction.STATUS_BOUGHT
                        auction.paid_at = payment.paid_at
                        if not auction.winning_amount:
                            auction.winning_amount = auction.current_bid
                        auction.save(update_fields=["winner_payment_status", "status", "paid_at", "winning_amount"])
            elif keepz_status in terminal_failed_statuses:
                from django.utils import timezone
                if keepz_status == "CANCELED":
                    payment.status = PaymentSession.STATUS_CANCELED
                elif keepz_status == "EXPIRED":
                    payment.status = PaymentSession.STATUS_EXPIRED
                else:
                    payment.status = PaymentSession.STATUS_FAILED
                payment.failed_at = payment.failed_at or timezone.now()
                payment.save(update_fields=[
                    "status", "failed_at", "provider_transaction_id", "callback_payload",
                    "response_payload", "updated_at",
                ])
                if payment.order_id:
                    _mark_order_payment_failed(payment.order, f"Keepz payment status: {keepz_status}")
                elif payment.purpose == PaymentSession.PURPOSE_AUCTION and payment.related_id:
                    from apps.auctions.models import Auction

                    Auction.objects.filter(pk=payment.related_id).update(winner_payment_status=Auction.PAYMENT_FAILED)
            else:
                payment.save(update_fields=[
                    "provider_transaction_id", "callback_payload", "response_payload", "updated_at",
                ])

        return Response({"detail": "ok", "verified_status": keepz_status})


class DeliveryOptionListView(APIView):
    """Public endpoint returning active delivery options."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        from .serializers import DeliveryOptionSerializer
        opts = DeliveryOption.objects.filter(is_active=True)
        return Response(DeliveryOptionSerializer(opts, many=True).data)


class CartShippingOptionListView(APIView):
    """Shipping methods for the vendors represented in the authenticated cart."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        market = "GE" if request.query_params.get("country") == "GE" else "OTHER"
        cart = Cart.objects.filter(user=request.user).first()
        if not cart:
            return Response([])

        # Build vendor_id → set of product_ids in cart, and track ready-to-ship per vendor
        vendor_products: dict[int, set[int]] = {}
        vendor_all_ready: dict[int, bool] = {}
        for item in cart.items.select_related(
            "size_variant__product", "variant__product"
        ):
            product = (
                item.size_variant.product if item.size_variant_id
                else item.variant.product if item.variant_id
                else None
            )
            if product and product.vendor_id:
                vendor_products.setdefault(product.vendor_id, set()).add(product.pk)
                item_ready = (
                    item.size_variant.is_ready_to_ship and (item.size_variant.stock or 0) > 0
                ) if item.size_variant_id else False
                if product.vendor_id not in vendor_all_ready:
                    vendor_all_ready[product.vendor_id] = item_ready
                else:
                    vendor_all_ready[product.vendor_id] = vendor_all_ready[product.vendor_id] and item_ready

        vendor_ids = set(vendor_products.keys())
        if not vendor_ids:
            return Response([])

        options = VendorShippingOption.objects.filter(
            vendor_id__in=vendor_ids,
            market=market,
            is_active=True,
        ).select_related("vendor").order_by("vendor_id", "sort_order", "price", "id")

        data = []
        for opt in options:
            # Hide express options unless all that vendor's cart items are ready to ship
            if opt.is_express and not vendor_all_ready.get(opt.vendor_id, False):
                continue

            data.append({
                "id": opt.id,
                "slug": f"vendor-{opt.id}",
                "label": opt.label,
                "vendor_id": opt.vendor_id,
                "vendor_name": opt.vendor.name if opt.vendor_id else "",
                "price": str(opt.price),
                "price_gel": str(opt.price if market == "GE" else 0),
                "price_usd": str(opt.price if market != "GE" else 0),
                "est_days_min": opt.est_days_min,
                "est_days_max": opt.est_days_max,
                "market": opt.market,
                "is_express": opt.is_express,
                "is_pickup": False,
            })

        from apps.vendors.models import Vendor

        vendors = Vendor.objects.select_related("user").filter(pk__in=vendor_ids)
        for vendor in vendors:
            if not _vendor_allows_self_pickup(vendor):
                continue
            data.append({
                "id": -vendor.id,
                "slug": f"pickup-{vendor.id}",
                "label": "I will take it myself",
                "vendor_id": vendor.id,
                "vendor_name": vendor.name,
                "price": "0.00",
                "price_gel": "0.00",
                "price_usd": "0.00",
                "est_days_min": 0,
                "est_days_max": 0,
                "market": market,
                "is_express": False,
                "is_pickup": True,
            })
        return Response(data)


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
        from apps.core.uploads import validate_image_upload, safe_image_extension

        file = request.FILES.get("file")
        error = validate_image_upload(file)
        if error:
            return error

        ext = safe_image_extension(file)
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


class CustomOrderPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.conf import settings as django_settings
        from .keepz import KeepzGatewayError, create_keepz_order_for_custom_order

        order = CustomOrder.objects.filter(user=request.user, pk=pk).first()
        if not order:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if order.status != "approved":
            return Response({"detail": "Only approved custom orders can be paid."}, status=status.HTTP_400_BAD_REQUEST)
        if not order.price:
            return Response({"detail": "Custom order price is not set yet."}, status=status.HTTP_400_BAD_REQUEST)
        if order.currency.upper() not in {"GEL", "USD"}:
            return Response({"detail": "Custom order payment currency must be GEL or USD."}, status=status.HTTP_400_BAD_REQUEST)

        if not django_settings.KEEPZ_ENABLED:
            payment_url = f"/custom?pay={order.payment_ref}"
            order.payment_url = payment_url
            order.save(update_fields=["payment_url"])
            return Response({"payment_url": payment_url})

        payment = PaymentSession.objects.create(
            provider=PaymentSession.PROVIDER_KEEPZ,
            purpose=PaymentSession.PURPOSE_CUSTOM_ORDER,
            status=PaymentSession.STATUS_CREATED,
            user=order.user,
            related_id=str(order.pk),
            amount=order.price,
            currency=order.currency,
        )
        try:
            result = create_keepz_order_for_custom_order(payment)
        except (KeepzGatewayError, ValueError) as exc:
            payment.status = PaymentSession.STATUS_FAILED
            payment.last_error = str(exc)
            payment.save(update_fields=["status", "last_error", "updated_at"])
            provider_message = str(exc.payload.get("message") or "") if isinstance(exc, KeepzGatewayError) else ""
            detail = "Payment link could not be created."
            if provider_message:
                detail = f"{detail} {provider_message}"
            return Response({"detail": detail}, status=status.HTTP_502_BAD_GATEWAY)

        payment.payment_url = result.payment_url
        payment.request_payload = result.request_payload
        payment.response_payload = result.provider_payload
        payment.status = PaymentSession.STATUS_REDIRECTED
        payment.save(update_fields=["payment_url", "request_payload", "response_payload", "status", "updated_at"])
        order.payment_url = payment.payment_url
        order.save(update_fields=["payment_url"])
        return Response({"payment_url": payment.payment_url})
