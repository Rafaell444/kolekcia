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

from .models import Cart, CartItem, Order, OrderItem, OrderShipment, OrderStatusHistory, CustomOrder, DeliveryOption, ProcessingOption, VendorShippingOption
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
            if not size_variant.is_ready_to_ship and size_variant.stock is not None and size_variant.stock < quantity:
                return Response({"detail": "Insufficient stock."}, status=status.HTTP_400_BAD_REQUEST)
        elif variant_id:
            try:
                variant = ProductVariant.objects.select_for_update().select_related("product").get(pk=variant_id)
            except ProductVariant.DoesNotExist:
                return Response({"detail": "Variant not found."}, status=status.HTTP_404_NOT_FOUND)
            if variant.stock < quantity:
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
                if size_variant.stock is not None and new_quantity > size_variant.stock:
                    return Response(
                        {"detail": f"Only {size_variant.stock} item(s) available. You already have {item.quantity} in your cart."},
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
                if new_quantity > variant.stock:
                    return Response(
                        {"detail": f"Only {variant.stock} item(s) available. You already have {item.quantity} in your cart."},
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
                is_rts = item.size_variant.is_ready_to_ship if item.size_variant_id else False
                stock = item.size_variant.stock if item.size_variant_id else item.variant.stock
                if not is_rts and stock is not None and requested_quantity > stock:
                    return Response(
                        {"detail": f"Only {stock} item(s) available."},
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

        code = request.data.get("code", "").strip().upper()
        if not code:
            return Response({"detail": "Promo code is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            promo = PromoCode.objects.get(code=code)
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
                if variant and variant.stock < item.quantity:
                    return Response(
                        {"detail": f"'{variant.product.title}' has insufficient stock."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            elif item.size_variant_id:
                sv = locked_size_variants.get(item.size_variant_id)
                if sv and not sv.is_ready_to_ship and sv.stock is not None and sv.stock < item.quantity:
                    return Response(
                        {"detail": f"'{sv.product.title}' has insufficient stock."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        for item in items_to_process:
            if item.variant_id:
                ProductVariant.objects.filter(pk=item.variant_id).update(stock=F("stock") - item.quantity)
            elif item.size_variant_id:
                sv = locked_size_variants.get(item.size_variant_id)
                if sv and sv.stock is not None and sv.stock > 0:
                    new_stock = sv.stock - item.quantity
                    if new_stock <= 0 and sv.is_ready_to_ship:
                        SizeVariant.objects.filter(pk=item.size_variant_id).update(
                            stock=None, is_ready_to_ship=False,
                        )
                    else:
                        SizeVariant.objects.filter(pk=item.size_variant_id).update(
                            stock=F("stock") - item.quantity,
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
            priced_lines.append({
                "item": item,
                "unit_price": unit_price,
                "wrap": wrap,
                "proc_fee": proc_fee,
                "proc_label": proc_label or item.processing_label,
                "proc_days": proc_days or item.processing_days,
            })

        discount = Decimal("0")
        promo = cart.promo_code
        if promo:
            if promo.owner_id:
                # Creator voucher: one shared % off products only
                discount = promo.calculate_product_discount(product_subtotal)
            elif promo.is_scoped:
                # Scoped promo: only discount qualifying items
                items_with_products = []
                for line in priced_lines:
                    item = line["item"]
                    product = (
                        item.size_variant.product if item.size_variant_id
                        else item.variant.product if item.variant_id
                        else None
                    )
                    if product:
                        items_with_products.append((product, line["unit_price"] * item.quantity))
                discount = promo.calculate_scoped_discount(items_with_products)
            else:
                # Regular promo applies to products + extras (not shipping)
                discount = promo.calculate_discount(product_subtotal + gift_wrap_total + processing_fee_total)

        # subtotal = products only; extras + shipping listed separately
        total = product_subtotal + gift_wrap_total + processing_fee_total - discount + delivery_price

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
            status="processing",
        )

        # Create per-vendor shipments
        shipment_map: dict[int | None, OrderShipment] = {}
        for spec in shipment_specs:
            shipment = OrderShipment.objects.create(
                order=order,
                vendor_id=spec["vendor_id"],
                delivery_type=f"vendor-{spec['option'].pk}",
                delivery_label=spec["option"].label,
                delivery_price=Decimal(spec["option"].price),
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
                    product_title=product.title,
                    product_image=_absolute_product_image(image_url, request),
                    artist_name=product.artist.name if product.artist else "",
                    size_label=sv.label,
                    finish_label="",
                    frame_label="",
                    price=line["unit_price"],
                    quantity=item.quantity,
                    gift_wrap=item.gift_wrap,
                    gift_wrap_note=item.gift_wrap_note,
                    gift_wrap_image_url=_absolute_product_image(item.gift_wrap_image_url, request),
                    processing_option=item.processing_option,
                    processing_fee=line["proc_fee"],
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
                    product_title=variant.product.title,
                    product_image=_absolute_product_image(image_url, request),
                    artist_name=variant.product.artist.name if variant.product.artist else "",
                    size_label=variant.size.label,
                    finish_label=variant.finish.label,
                    frame_label=variant.frame.label,
                    price=line["unit_price"],
                    quantity=item.quantity,
                    gift_wrap=item.gift_wrap,
                    gift_wrap_note=item.gift_wrap_note,
                    gift_wrap_image_url=_absolute_product_image(item.gift_wrap_image_url, request),
                    processing_option=item.processing_option,
                    processing_fee=line["proc_fee"],
                    processing_label=line["proc_label"],
                    processing_days=line["proc_days"],
                )

        OrderStatusHistory.objects.create(
            order=order, status="processing", note="Payment successful — order is being processed.", changed_by=request.user
        )

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
                "status": "processing",
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

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related("items__vendor", "shipments__vendor", "status_history")


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related("items__vendor", "shipments__vendor", "status_history")


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
