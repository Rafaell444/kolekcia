from decimal import Decimal
from django.db.models import Sum, Count
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
        "name", "logo_url", "banner_url", "description", "payment_email",
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
        from apps.orders.models import OrderItem
        from apps.users.models import User
        vendor = get_vendor_for_request(request)
        if vendor:
            user_ids = (
                OrderItem.objects.filter(vendor=vendor)
                .values_list("order__user_id", flat=True)
                .distinct()
            )
            users = User.objects.filter(id__in=user_ids)
        else:
            users = User.objects.filter(role="customer")

        data = [{
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "date_joined": u.date_joined.strftime("%Y-%m-%d"),
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

        vendor = get_vendor_for_request(request)
        try:
            qs = CustomOrder.objects.all()
            if vendor:
                qs = qs.filter(vendor=vendor)
            order = qs.get(pk=pk)
        except CustomOrder.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        allowed = ("status",)
        data = {k: v for k, v in request.data.items() if k in allowed}
        ser = CustomOrderSerializer(order, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
