from decimal import Decimal
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.permissions import AllowAny
from rest_framework import generics

from .models import Vendor
from .serializers import VendorSerializer, VendorPublicSerializer, VendorStorefrontSerializer


class IsVendorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and (request.user.is_staff or hasattr(request.user, "vendor_profile"))
        )


def get_vendor_for_request(request):
    """Return the Vendor to scope queries to, or None (superadmin = no filter)."""
    if request.user.is_staff:
        slug = request.query_params.get("vendor")
        if slug:
            try:
                return Vendor.objects.get(slug=slug)
            except Vendor.DoesNotExist:
                return None
        return None  # superadmin with no filter → all data
    return getattr(request.user, "vendor_profile", None)


# ── Vendor profile ─────────────────────────────────────────────────────────────

def _apply_vendor_fields(vendor, data, staff=False):
    fields = (
        "name", "logo_url", "banner_url", "description", "payment_email", "merchant_id",
        "gift_wrap_price_gel", "gift_wrap_price_usd",
        "shipping_email_subject", "shipping_email_body",
        "social_website", "social_instagram", "social_facebook", "social_twitter", "social_tiktok", "social_youtube",
    )
    if staff:
        fields = fields + ("catalog_category_slug",)
    for field in fields:
        if field in data:
            setattr(vendor, field, data[field])
    vendor.save()


class VendorMeView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        if request.user.is_staff:
            vendors = Vendor.objects.select_related("user").all()
            return Response(VendorSerializer(vendors, many=True).data)
        vendor = getattr(request.user, "vendor_profile", None)
        if not vendor:
            return Response({"detail": "Not a vendor."}, status=403)
        return Response(VendorSerializer(vendor).data)

    def patch(self, request):
        vendor = getattr(request.user, "vendor_profile", None)
        if not vendor:
            return Response({"detail": "Not a vendor."}, status=403)
        _apply_vendor_fields(vendor, request.data, staff=False)
        return Response(VendorSerializer(vendor).data)


class VendorAdminDetailView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def patch(self, request, slug):
        if not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=403)
        try:
            vendor = Vendor.objects.get(slug=slug)
        except Vendor.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        _apply_vendor_fields(vendor, request.data, staff=True)
        return Response(VendorSerializer(vendor).data)


# ── Vendor dashboard ────────────────────────────────────────────────────────────

class VendorDashboardView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.orders.models import Order, OrderItem
        from apps.products.models import Product
        from apps.users.models import User

        vendor = get_vendor_for_request(request)
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        product_qs = Product.objects.filter(vendor=vendor) if vendor else Product.objects.all()
        item_qs = OrderItem.objects.filter(vendor=vendor) if vendor else OrderItem.objects.all()

        paid_items = item_qs.filter(order__status__in=["processing", "shipped", "delivered"])
        revenue = paid_items.aggregate(total=Sum("price"))["total"] or Decimal("0")
        total_orders = item_qs.values("order").distinct().count()
        orders_30d = item_qs.filter(order__created_at__gte=thirty_days_ago).values("order").distinct().count()
        unique_customers = item_qs.values("order__user").distinct().count()

        return Response({
            "total_revenue": str(revenue),
            "total_orders": total_orders,
            "total_products": product_qs.count(),
            "orders_last_30d": orders_30d,
            "unique_customers": unique_customers,
            "active_since": vendor.created_at.strftime("%b %Y") if vendor else None,
        })


# ── Vendor products ─────────────────────────────────────────────────────────────

def _vendor_product_queryset(request):
    from apps.products.models import Product
    vendor = get_vendor_for_request(request)
    qs = Product.objects.select_related("artist", "category", "vendor").prefetch_related(
        "images", "variants__size", "variants__finish", "variants__frame",
        "size_variants", "categories",
    )
    if vendor:
        qs = qs.filter(vendor=vendor)
    return qs


class VendorProductListView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.products.serializers import ProductDetailSerializer
        qs = _vendor_product_queryset(request)
        return Response(ProductDetailSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        from apps.products.serializers import ProductDetailSerializer
        ser = ProductDetailSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        product = ser.save()
        return Response(
            ProductDetailSerializer(product, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class VendorProductDetailView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def _get_product(self, request, pk):
        from apps.products.models import Product
        try:
            return _vendor_product_queryset(request).get(pk=pk)
        except Product.DoesNotExist:
            return None

    def get(self, request, pk):
        from apps.products.serializers import ProductDetailSerializer
        product = self._get_product(request, pk)
        if not product:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProductDetailSerializer(product, context={"request": request}).data)

    def patch(self, request, pk):
        from apps.products.serializers import ProductDetailSerializer
        product = self._get_product(request, pk)
        if not product:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = ProductDetailSerializer(
            product, data=request.data, partial=True, context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        product = ser.save()
        return Response(ProductDetailSerializer(product, context={"request": request}).data)

    def delete(self, request, pk):
        product = self._get_product(request, pk)
        if not product:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Vendor orders ───────────────────────────────────────────────────────────────

class VendorOrderListView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.orders.models import Order, OrderItem
        from apps.orders.serializers import OrderSerializer
        vendor = get_vendor_for_request(request)
        if vendor:
            order_ids = OrderItem.objects.filter(vendor=vendor).values_list("order_id", flat=True).distinct()
            qs = Order.objects.filter(id__in=order_ids).prefetch_related("items", "status_history")
        else:
            qs = Order.objects.prefetch_related("items", "status_history").all()
        return Response(OrderSerializer(qs, many=True).data)


# ── Vendor customers ────────────────────────────────────────────────────────────

class VendorCustomerListView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.orders.models import OrderItem, CustomOrder
        from apps.users.models import User
        from django.db.models import Count

        vendor = get_vendor_for_request(request)
        if vendor:
            order_user_ids = (
                OrderItem.objects.filter(vendor=vendor, order__user__isnull=False)
                .values_list("order__user_id", flat=True)
                .distinct()
            )
            custom_user_ids = (
                CustomOrder.objects.filter(vendor=vendor, user__isnull=False)
                .values_list("user_id", flat=True)
                .distinct()
            )
            user_ids = set(order_user_ids) | set(custom_user_ids)
            users = (
                User.objects.filter(id__in=user_ids, is_staff=False)
                .exclude(vendor_profile__isnull=False)
                .annotate(
                    orders_count=Count(
                        "orders",
                        distinct=True,
                        filter=Q(orders__items__vendor=vendor),
                    )
                )
            )
        else:
            users = User.objects.filter(role="customer")

        data = [{
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "date_joined": u.date_joined.strftime("%Y-%m-%d"),
            "orders_count": getattr(u, "orders_count", 0),
        } for u in users]
        return Response(data)


# ── Vendor analytics ────────────────────────────────────────────────────────────

class VendorAnalyticsView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.orders.models import OrderItem
        from django.db.models.functions import TruncMonth

        vendor = get_vendor_for_request(request)
        qs = OrderItem.objects.filter(order__status__in=["processing", "shipped", "delivered"])
        if vendor:
            qs = qs.filter(vendor=vendor)

        data = (
            qs.annotate(month=TruncMonth("order__created_at"))
            .values("month")
            .annotate(revenue=Sum("price"), orders=Count("order_id", distinct=True))
            .order_by("month")
        )
        return Response([
            {
                "month": item["month"].strftime("%b %Y") if item["month"] else "",
                "revenue": str(item["revenue"] or 0),
                "orders": item["orders"],
            }
            for item in data
        ])


# -- Public vendor list (no auth) � used by custom order picker -----------------

class VendorPublicListView(generics.ListAPIView):
    serializer_class = VendorPublicSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return Vendor.objects.filter(custom_product_type__isnull=False).exclude(custom_product_type="")


class VendorPublicByCategoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, category_slug):
        vendor = Vendor.objects.filter(catalog_category_slug=category_slug).first()
        if not vendor:
            return Response({"detail": "Not found."}, status=404)
        return Response(VendorStorefrontSerializer(vendor).data)


# -- Vendor-scoped custom orders -------------------------------------------------

class VendorCustomOrderListView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.orders.models import CustomOrder
        from apps.orders.serializers import CustomOrderSerializer

        vendor = get_vendor_for_request(request)
        qs = CustomOrder.objects.select_related("vendor").order_by("-created_at")
        if vendor:
            qs = qs.filter(vendor=vendor)
        return Response(CustomOrderSerializer(qs, many=True).data)

    def patch(self, request, pk=None):
        from apps.orders.models import CustomOrder
        from apps.orders.serializers import CustomOrderSerializer
        from django.utils import timezone

        vendor = get_vendor_for_request(request)
        try:
            qs = CustomOrder.objects.all()
            if vendor:
                qs = qs.filter(vendor=vendor)
            order = qs.get(pk=pk)
        except CustomOrder.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        allowed = ("status", "cancel_reason", "price", "currency", "payment_url", "tracking_code")
        data = {k: v for k, v in request.data.items() if k in allowed}
        new_status = data.get("status", order.status)

        if new_status == "paid":
            data["paid_at"] = timezone.now()
            data["payment_url"] = ""
        if new_status == "cancelled" and not (data.get("cancel_reason") or order.cancel_reason):
            return Response({"detail": "cancel_reason is required when cancelling."}, status=400)
        if new_status == "approved" and data.get("price") and not data.get("payment_url"):
            # Auto-generate a placeholder payment link vendors can replace
            data.setdefault("payment_url", f"/custom?pay={order.payment_ref}")

        ser = CustomOrderSerializer(order, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class VendorMediaUploadView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def post(self, request):
        import os
        import uuid as uuid_lib
        from django.conf import settings as django_settings
        from apps.core.uploads import validate_image_upload, safe_image_extension

        vendor = getattr(request.user, "vendor_profile", None)
        if not vendor:
            return Response({"detail": "Vendor profile required."}, status=403)

        file = request.FILES.get("file")
        kind = request.data.get("kind", "logo")
        error = validate_image_upload(file)
        if error:
            return error
        if kind not in ("logo", "banner"):
            return Response({"detail": "kind must be logo or banner."}, status=400)

        ext = safe_image_extension(file)
        filename = f"{vendor.slug}-{kind}-{uuid_lib.uuid4().hex[:8]}{ext}"
        save_dir = os.path.join(django_settings.MEDIA_ROOT, "vendors")
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, filename)
        with open(save_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)
        url = request.build_absolute_uri(f"{django_settings.MEDIA_URL}vendors/{filename}")
        if kind == "logo":
            vendor.logo_url = url
        else:
            vendor.banner_url = url
        vendor.save(update_fields=["logo_url" if kind == "logo" else "banner_url"])
        return Response({"url": url, "kind": kind}, status=201)


class VendorShippingListView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.orders.models import VendorShippingOption
        from apps.orders.serializers import VendorShippingOptionSerializer

        vendor = get_vendor_for_request(request)
        if not vendor:
            return Response({"detail": "Vendor profile required."}, status=403)
        opts = VendorShippingOption.objects.filter(vendor=vendor)
        return Response(VendorShippingOptionSerializer(opts, many=True).data)

    def post(self, request):
        from apps.orders.models import VendorShippingOption
        from apps.orders.serializers import VendorShippingOptionSerializer

        vendor = get_vendor_for_request(request)
        if not vendor:
            return Response({"detail": "Vendor profile required."}, status=403)
        ser = VendorShippingOptionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        opt = VendorShippingOption.objects.create(vendor=vendor, **ser.validated_data)
        return Response(VendorShippingOptionSerializer(opt).data, status=201)


class VendorShippingDetailView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def patch(self, request, pk):
        from apps.orders.models import VendorShippingOption
        from apps.orders.serializers import VendorShippingOptionSerializer

        vendor = get_vendor_for_request(request)
        if not vendor:
            return Response({"detail": "Vendor profile required."}, status=403)
        try:
            opt = VendorShippingOption.objects.get(pk=pk, vendor=vendor)
        except VendorShippingOption.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        ser = VendorShippingOptionSerializer(opt, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        from apps.orders.models import VendorShippingOption

        vendor = get_vendor_for_request(request)
        if not vendor:
            return Response({"detail": "Vendor profile required."}, status=403)
        try:
            VendorShippingOption.objects.get(pk=pk, vendor=vendor).delete()
        except VendorShippingOption.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        return Response(status=204)


class VendorCatalogFilterConfigView(APIView):
    permission_classes = [IsAuthenticated, IsVendorOrAdmin]

    def get(self, request):
        from apps.products.models import CatalogFilterConfig, DEFAULT_VISIBLE_FILTERS
        from apps.products.filter_config import _apply_config

        vendor = get_vendor_for_request(request)
        if not vendor:
            return Response({"detail": "Vendor profile required."}, status=403)
        merged = dict(DEFAULT_VISIBLE_FILTERS)
        cfg = CatalogFilterConfig.objects.filter(scope="vendor", vendor=vendor).first()
        merged = _apply_config(merged, cfg)
        return Response(merged)

    def patch(self, request):
        from apps.products.models import CatalogFilterConfig

        vendor = get_vendor_for_request(request)
        if not vendor:
            return Response({"detail": "Vendor profile required."}, status=403)
        visible_filters = request.data.get("visible_filters", {})
        cfg, _ = CatalogFilterConfig.objects.update_or_create(
            scope="vendor",
            vendor=vendor,
            defaults={
                "category_slug": vendor.catalog_category_slug or "",
                "visible_filters": visible_filters,
            },
        )
        return Response(cfg.resolved_filters())
