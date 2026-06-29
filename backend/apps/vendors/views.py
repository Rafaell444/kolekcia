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
from .serializers import VendorSerializer, VendorPublicSerializer


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
        for field in ("name", "logo_url", "description", "payment_email"):
            if field in request.data:
                setattr(vendor, field, request.data[field])
        vendor.save()
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

class VendorProductListView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def get(self, request):
        from apps.products.models import Product
        from apps.products.serializers import ProductListSerializer
        vendor = get_vendor_for_request(request)
        qs = Product.objects.select_related("artist", "category").prefetch_related("images", "variants")
        if vendor:
            qs = qs.filter(vendor=vendor)
        return Response(ProductListSerializer(qs, many=True).data)

    def post(self, request):
        from apps.products.models import (
            Product, ProductImage, ProductVariant,
            Category, Artist, PosterSize, PosterFinish, PosterFrame,
        )
        from apps.products.serializers import ProductDetailSerializer
        vendor = get_vendor_for_request(request)
        data = request.data

        category = Category.objects.filter(slug=data.get("category_slug", "")).first()
        artist_handle = data.get("artist_handle", "")
        artist = Artist.objects.filter(handle=artist_handle).first() if artist_handle else None

        tags = data.get("tags", [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]

        product = Product.objects.create(
            title=data.get("title", "Untitled"),
            artist=artist,
            category=category,
            base_price=data.get("base_price", "0"),
            original_price=data.get("original_price") or None,
            is_limited=bool(data.get("is_limited", False)),
            is_sale=bool(data.get("is_sale", False)),
            is_new=bool(data.get("is_new", True)),
            is_exclusive=bool(data.get("is_exclusive", False)),
            tags=tags,
            vendor=vendor,
        )

        if data.get("image_url"):
            ProductImage.objects.create(product=product, url=data["image_url"], order=0)

        try:
            default_size = PosterSize.objects.get(id="m")
            default_finish = PosterFinish.objects.get(id="matte")
            default_frame = PosterFrame.objects.get(id="none")
            ProductVariant.objects.create(
                product=product, size=default_size, finish=default_finish,
                frame=default_frame, stock=100,
            )
        except Exception:
            pass

        return Response(ProductDetailSerializer(product).data, status=status.HTTP_201_CREATED)


class VendorProductDetailView(APIView):
    permission_classes = [IsVendorOrAdmin]

    def _get_product(self, request, pk):
        from apps.products.models import Product
        vendor = get_vendor_for_request(request)
        qs = Product.objects.select_related("vendor")
        if vendor:
            qs = qs.filter(vendor=vendor)
        try:
            return qs.get(pk=pk)
        except Product.DoesNotExist:
            return None

    def patch(self, request, pk):
        from apps.products.models import Product, ProductImage
        from apps.products.serializers import ProductDetailSerializer
        product = self._get_product(request, pk)
        if not product:
            return Response({"detail": "Not found."}, status=404)
        data = request.data
        for field in ("title", "base_price", "original_price", "is_limited", "is_sale", "is_new", "is_exclusive", "tags"):
            if field in data:
                setattr(product, field, data[field])
        product.save()
        if data.get("image_url"):
            ProductImage.objects.filter(product=product).delete()
            ProductImage.objects.create(product=product, url=data["image_url"], order=0)
        return Response(ProductDetailSerializer(product).data)

    def delete(self, request, pk):
        product = self._get_product(request, pk)
        if not product:
            return Response({"detail": "Not found."}, status=404)
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
