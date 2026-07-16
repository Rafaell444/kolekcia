from django.contrib.auth import authenticate
from django.db.models import Sum, Count, Q, Max
from django.db.models.functions import TruncMonth, TruncDate
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsAdminUser, IsAdminOrVendor
from .models import AuditLog
from .audit import log_action


class AdminNoPaginationMixin:
    pagination_class = None


# ── Admin login ────────────────────────────────────────────────────────────────

class AdminLoginView(APIView):
    """Login endpoint exclusively for staff and vendor users."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        user = authenticate(request, username=email, password=password)
        if not user or not user.is_active:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        is_vendor = hasattr(user, "vendor_profile")
        if not user.is_staff and not is_vendor:
            return Response({"detail": "Access denied. Vendor or admin account required."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)

        vendor_data = None
        if is_vendor:
            v = user.vendor_profile
            vendor_data = {"id": v.id, "name": v.name, "slug": v.slug, "logo_url": v.logo_url}

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "is_staff": user.is_staff,
                "vendor": vendor_data,
            },
        })


# ── Serializers ──────────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    admin_email = serializers.CharField(source="admin_user.email", read_only=True, allow_null=True)
    summary = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ("id", "admin_email", "action", "target_type", "target_id", "detail", "summary", "category", "timestamp")

    def get_summary(self, obj):
        d = obj.detail or {}
        if obj.action == "order_created":
            return f"Order {d.get('order_number', obj.target_id)} — {d.get('total', '')} {d.get('currency', '')}".strip()
        if obj.action == "order_status_change":
            return f"Order status → {d.get('new_status', '')}"
        if obj.action == "payment_received":
            return f"Payment {d.get('payment_ref', '')} — {d.get('amount', '')} {d.get('currency', '')}".strip()
        if obj.action == "settings_update":
            return f"Updated settings: {', '.join(d.get('keys', []))}"
        if obj.action == "vendor_ops_update":
            return f"Vendor {d.get('vendor_slug', '')} settings updated"
        if obj.action in ("create", "update", "delete") and obj.target_type == "page_section":
            return f"{obj.action.title()} section {d.get('section_key', obj.target_id)}"
        return f"{obj.action} on {obj.target_type} #{obj.target_id}"

    def get_category(self, obj):
        t = obj.target_type.lower()
        if t == "order" or obj.action.startswith("order"):
            return "Order"
        if "payment" in obj.action or t == "customorder":
            return "Payment"
        if t in ("product", "productvariant"):
            return "Product"
        if t in ("sitesettings", "vendor") or obj.action == "settings_update":
            return "Settings"
        if t in ("page_section", "blog_post", "hero_slide", "banner"):
            return "Content"
        return "System"


# ── Dashboard ─────────────────────────────────────────────────────────────────

class AdminDashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.orders.models import Order
        from apps.users.models import User
        from apps.products.models import Product
        from apps.auctions.models import Auction

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        total_revenue = Order.objects.filter(
            status__in=["processing", "shipped", "delivered"]
        ).aggregate(total=Sum("total"))["total"] or 0

        return Response({
            "total_revenue": str(total_revenue),
            "total_orders": Order.objects.count(),
            "total_users": User.objects.count(),
            "total_products": Product.objects.count(),
            "orders_last_30d": Order.objects.filter(created_at__gte=thirty_days_ago).count(),
            "new_users_last_30d": User.objects.filter(date_joined__gte=thirty_days_ago).count(),
            "active_auctions": Auction.objects.filter(ends_at__gt=now).count(),
        })


class AdminAnalyticsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.orders.models import Order
        data = (
            Order.objects.filter(status__in=["processing", "shipped", "delivered"])
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(revenue=Sum("total"), orders=Count("id"))
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


class AdminSuperAnalyticsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.orders.models import Order
        from apps.auctions.models import Auction, AuctionBid
        from apps.users.models import User

        now = timezone.now()
        today = now.date()
        yesterday = today - timedelta(days=1)
        last_30_days_start = today - timedelta(days=29)
        completed_statuses = ["processing", "shipped", "delivered"]

        orders_qs = Order.objects.filter(status__in=completed_statuses)

        total_revenue = float(orders_qs.aggregate(total=Sum("total"))["total"] or 0)
        total_orders = orders_qs.count()
        total_users = User.objects.count()
        total_bids = AuctionBid.objects.count()
        total_auctions = Auction.objects.count()
        active_auctions = Auction.objects.filter(ends_at__gt=now).count()

        today_orders_qs = orders_qs.filter(created_at__date=today)
        yesterday_orders_qs = orders_qs.filter(created_at__date=yesterday)

        today_revenue = float(today_orders_qs.aggregate(total=Sum("total"))["total"] or 0)
        yesterday_revenue = float(yesterday_orders_qs.aggregate(total=Sum("total"))["total"] or 0)
        today_orders = today_orders_qs.count()
        yesterday_orders = yesterday_orders_qs.count()

        today_bids = AuctionBid.objects.filter(placed_at__date=today).count()
        yesterday_bids = AuctionBid.objects.filter(placed_at__date=yesterday).count()

        def pct_change(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100.0, 2)

        daily_orders = (
            orders_qs.filter(created_at__date__gte=last_30_days_start)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(revenue=Sum("total"), orders=Count("id"))
            .order_by("day")
        )
        daily_bids = (
            AuctionBid.objects.filter(placed_at__date__gte=last_30_days_start)
            .annotate(day=TruncDate("placed_at"))
            .values("day")
            .annotate(bids=Count("id"), max_bid=Max("amount"))
            .order_by("day")
        )

        bids_map = {
            b["day"]: {"bids": b["bids"], "max_bid": float(b["max_bid"] or 0)}
            for b in daily_bids
        }

        by_day = []
        for i in range(30):
            day = last_30_days_start + timedelta(days=i)
            order_row = next((o for o in daily_orders if o["day"] == day), None)
            bid_row = bids_map.get(day, {"bids": 0, "max_bid": 0.0})
            by_day.append(
                {
                    "day": day.strftime("%Y-%m-%d"),
                    "orders": int(order_row["orders"]) if order_row else 0,
                    "revenue": float(order_row["revenue"] or 0) if order_row else 0.0,
                    "bids": int(bid_row["bids"]),
                    "max_bid": float(bid_row["max_bid"]),
                }
            )

        auction_bidder_rows = []
        auctions = (
            Auction.objects.select_related("product")
            .prefetch_related("bids__user")
            .order_by("-created_at")[:50]
        )
        for auction in auctions:
            bids = list(auction.bids.all().order_by("-amount", "-placed_at"))
            if not bids:
                continue
            unique_bidder_ids = set()
            bidder_list = []
            for bid in bids:
                unique_bidder_ids.add(str(bid.user_id))
                bidder_list.append(
                    {
                        "bid_id": bid.id,
                        "bidder_name": bid.user.name or bid.user.email,
                        "bidder_email": bid.user.email,
                        "amount": float(bid.amount),
                        "placed_at": bid.placed_at.isoformat(),
                    }
                )
            auction_bidder_rows.append(
                {
                    "auction_id": auction.id,
                    "title": auction.title,
                    "product_id": auction.product_id,
                    "product_title": auction.product.title if auction.product else auction.title,
                    "ends_at": auction.ends_at.isoformat(),
                    "current_bid": float(bids[0].amount),
                    "total_bids": len(bids),
                    "unique_bidders": len(unique_bidder_ids),
                    "bidders": bidder_list,
                }
            )

        auction_bidder_rows.sort(key=lambda x: (x["total_bids"], x["current_bid"]), reverse=True)

        return Response(
            {
                "totals": {
                    "revenue": total_revenue,
                    "orders": total_orders,
                    "users": total_users,
                    "bids": total_bids,
                    "auctions": total_auctions,
                    "active_auctions": active_auctions,
                },
                "today": {
                    "date": today.strftime("%Y-%m-%d"),
                    "revenue": today_revenue,
                    "orders": today_orders,
                    "bids": today_bids,
                },
                "rates": {
                    "revenue_change_pct_vs_yesterday": pct_change(today_revenue, yesterday_revenue),
                    "orders_change_pct_vs_yesterday": pct_change(today_orders, yesterday_orders),
                    "bids_change_pct_vs_yesterday": pct_change(today_bids, yesterday_bids),
                },
                "by_day": by_day,
                "auction_bidder_breakdown": auction_bidder_rows,
            }
        )


# ── Orders ────────────────────────────────────────────────────────────────────

class AdminOrderListView(AdminNoPaginationMixin, generics.ListAPIView):
    permission_classes = [IsAdminOrVendor]

    def get_serializer_class(self):
        from apps.orders.serializers import OrderSerializer
        return OrderSerializer

    def get_queryset(self):
        from apps.orders.models import Order
        qs = Order.objects.prefetch_related("items", "status_history").all()
        if not self.request.user.is_staff and hasattr(self.request.user, "vendor_profile"):
            vendor = self.request.user.vendor_profile
            qs = qs.filter(items__vendor=vendor).distinct()
        return qs


class AdminOrderUpdateView(APIView):
    permission_classes = [IsAdminOrVendor]

    def _get_order_qs(self, request):
        from apps.orders.models import Order
        qs = Order.objects.prefetch_related("items__vendor", "status_history")
        if not request.user.is_staff:
            # Vendors can only see orders that contain at least one of their products
            vendor = request.user.vendor_profile
            qs = qs.filter(items__vendor=vendor).distinct()
        return qs

    def get(self, request, pk):
        from apps.orders.serializers import OrderSerializer
        try:
            order = self._get_order_qs(request).get(pk=pk)
        except Exception:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)

    def patch(self, request, pk):
        from apps.orders.models import Order, OrderStatusHistory
        from apps.orders.serializers import OrderSerializer
        try:
            order = self._get_order_qs(request).get(pk=pk)
        except Exception:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        note = request.data.get("note", "")
        tracking = request.data.get("tracking_code")

        prev_status = order.status

        if new_status and new_status != prev_status:
            order.status = new_status
            OrderStatusHistory.objects.create(order=order, status=new_status, note=note, changed_by=request.user)
            log_action(request.user, "order_status_change", "Order", order.pk, {
                "new_status": new_status,
                "order_number": order.order_number,
            })
            if new_status == "processing":
                log_action(request.user, "payment_received", "Order", order.pk, {
                    "order_number": order.order_number,
                    "amount": str(order.total),
                    "currency": order.currency,
                })

        if tracking is not None:
            order.tracking_code = tracking

        order.save()

        # Send shipping confirmation email when status moves to "shipped"
        if new_status == "shipped" and prev_status != "shipped":
            _send_shipping_email(order)

        return Response(OrderSerializer(order).data)


def _send_shipping_email(order):
    """Send a shipping confirmation email to the customer using vendor template when available."""
    try:
        from django.core.mail import send_mail
        from django.conf import settings as django_settings

        first_item = order.items.select_related("vendor").first()
        vendor = first_item.vendor if first_item else None

        tracking_info = (
            f"\n\nTracking number: {order.tracking_code}"
            if order.tracking_code else ""
        )
        customer_name = order.shipping_name or "there"
        order_number = order.order_number

        if vendor and vendor.shipping_email_body:
            body = vendor.shipping_email_body
            body = body.replace("{{customer_name}}", customer_name)
            body = body.replace("{{order_number}}", order_number)
            body = body.replace("{{tracking_code}}", order.tracking_code or "")
            body = body.replace("{{tracking_info}}", tracking_info)
            subject = (vendor.shipping_email_subject or f"Your order {order_number} has shipped!")
            subject = subject.replace("{{order_number}}", order_number)
            from_email = vendor.payment_email or getattr(django_settings, "DEFAULT_FROM_EMAIL", "noreply@kolekcia.com")
        else:
            items_list = "\n".join(
                f"  • {item.product_title} × {item.quantity}"
                for item in order.items.all()
            )
            body = (
                f"Hi {customer_name},\n\n"
                f"Great news — your Kolekcia order {order_number} has been shipped!{tracking_info}\n\n"
                f"Items in your order:\n{items_list}\n\n"
                f"Shipping to:\n"
                f"  {order.shipping_line1}"
                + (f", {order.shipping_line2}" if order.shipping_line2 else "")
                + f"\n  {order.shipping_city}, {order.shipping_state} {order.shipping_zip}\n"
                f"  {order.shipping_country}\n\n"
                f"Thank you for shopping with Kolekcia!\n"
                f"— The Kolekcia Team"
            )
            subject = f"Your order {order_number} has shipped!"
            from_email = getattr(django_settings, "DEFAULT_FROM_EMAIL", "noreply@kolekcia.com")

        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[order.shipping_email],
            fail_silently=True,
        )
    except Exception:
        pass


# ── Products ──────────────────────────────────────────────────────────────────

class AdminProductListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminOrVendor]

    def get_serializer_class(self):
        from apps.products.serializers import ProductDetailSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        from apps.products.models import Product
        qs = Product.objects.select_related("artist", "category").prefetch_related("images", "variants__size", "variants__finish", "variants__frame", "size_variants", "categories")
        if not self.request.user.is_staff and hasattr(self.request.user, "vendor_profile"):
            qs = qs.filter(vendor=self.request.user.vendor_profile)
        return qs


class AdminProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrVendor]

    def get_serializer_class(self):
        from apps.products.serializers import ProductDetailSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        from apps.products.models import Product
        qs = Product.objects.select_related("artist", "category").prefetch_related("images", "variants__size", "variants__finish", "variants__frame", "size_variants", "categories")
        if not self.request.user.is_staff and hasattr(self.request.user, "vendor_profile"):
            qs = qs.filter(vendor=self.request.user.vendor_profile)
        return qs

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "product_update", "Product", instance.pk, {"title": instance.title})

    def perform_destroy(self, instance):
        log_action(self.request.user, "product_delete", "Product", instance.pk, {"title": instance.title})
        instance.delete()


class AdminProductStockView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        from apps.products.models import ProductVariant
        try:
            variant = ProductVariant.objects.select_related("product").get(pk=pk)
        except ProductVariant.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []
        new_stock = request.data.get("stock")
        if new_stock is not None:
            old_stock = variant.stock
            variant.stock = int(new_stock)
            update_fields.append("stock")
            log_action(request.user, "stock_update", "ProductVariant", variant.pk, {
                "product": variant.product.title, "old_stock": old_stock, "new_stock": variant.stock
            })
        new_surcharge = request.data.get("surcharge")
        if new_surcharge is not None:
            from decimal import Decimal
            variant.surcharge = Decimal(str(new_surcharge))
            update_fields.append("surcharge")
        if not update_fields:
            return Response({"detail": "stock or surcharge is required."}, status=status.HTTP_400_BAD_REQUEST)
        variant.save(update_fields=update_fields)
        return Response({"id": variant.pk, "stock": variant.stock, "surcharge": str(variant.surcharge)})


ALLOWED_MEDIA_FOLDERS = frozenset({"blog", "hero", "categories", "auctions", "artists", "cms"})


class AdminMediaUploadView(APIView):
    """Generic admin media upload for CMS and catalog assets."""
    permission_classes = [IsAdminOrVendor]

    def post(self, request):
        import os
        import uuid as uuid_lib
        from django.conf import settings as django_settings

        uploaded_file = request.FILES.get("file")
        folder = (request.data.get("folder") or "cms").strip().lower()

        if not uploaded_file:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        if folder not in ALLOWED_MEDIA_FOLDERS:
            return Response(
                {"detail": f"folder must be one of: {', '.join(sorted(ALLOWED_MEDIA_FOLDERS))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = os.path.splitext(uploaded_file.name)[1] or ".bin"
        filename = f"{uuid_lib.uuid4().hex}{ext}"
        save_dir = os.path.join(django_settings.MEDIA_ROOT, folder)
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, filename)
        with open(save_path, "wb") as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        url = request.build_absolute_uri(f"{django_settings.MEDIA_URL}{folder}/{filename}")
        return Response({"url": url, "folder": folder}, status=status.HTTP_201_CREATED)


class AdminProductMediaView(APIView):
    """Upload a video (or image file) to a product's media gallery."""
    permission_classes = [IsAdminOrVendor]

    def post(self, request):
        from apps.products.models import Product, ProductImage
        from apps.products.serializers import ProductImageSerializer
        product_id = request.data.get("product_id")
        uploaded_file = request.FILES.get("file")
        media_type = request.data.get("media_type", "image")

        if not product_id or not uploaded_file:
            return Response({"detail": "product_id and file are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_staff and hasattr(request.user, "vendor_profile"):
            if product.vendor_id != request.user.vendor_profile.id:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        max_order = product.images.count()

        img = ProductImage.objects.create(
            product=product,
            video_file=uploaded_file,
            media_type=media_type,
            order=max_order,
        )

        return Response(ProductImageSerializer(img, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def delete(self, request, image_id):
        from apps.products.models import ProductImage
        try:
            img = ProductImage.objects.get(pk=image_id)
            if img.video_file:
                img.video_file.delete(save=False)
            img.delete()
        except ProductImage.DoesNotExist:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminProductMediaReorderView(APIView):
    """PATCH /admin/products/media/reorder/ — accept [{id, order}] and bulk-update ProductImage.order."""
    permission_classes = [IsAdminOrVendor]

    def patch(self, request):
        from apps.products.models import ProductImage
        items = request.data if isinstance(request.data, list) else request.data.get("items", [])
        if not items:
            return Response({"detail": "items list required."}, status=status.HTTP_400_BAD_REQUEST)
        ids = [item["id"] for item in items if "id" in item]
        images = {img.pk: img for img in ProductImage.objects.filter(pk__in=ids)}
        updated = []
        for item in items:
            img = images.get(item.get("id"))
            if img is not None and "order" in item:
                img.order = item["order"]
                updated.append(img)
        ProductImage.objects.bulk_update(updated, ["order"])
        return Response({"updated": len(updated)})


# ── Categories ────────────────────────────────────────────────────────────────

class AdminCategoryListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminOrVendor]

    def get_serializer_class(self):
        from apps.products.serializers import CategorySerializer
        return CategorySerializer

    def get_queryset(self):
        from apps.products.models import Category
        return Category.objects.all()


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrVendor]

    def get_serializer_class(self):
        from apps.products.serializers import CategorySerializer
        return CategorySerializer

    def get_queryset(self):
        from apps.products.models import Category
        return Category.objects.all()


# ── Artists ───────────────────────────────────────────────────────────────────

class AdminArtistListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.products.serializers import ArtistSerializer
        return ArtistSerializer

    def get_queryset(self):
        from apps.products.models import Artist
        return Artist.objects.all()


class AdminArtistDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.products.serializers import ArtistSerializer
        return ArtistSerializer

    def get_queryset(self):
        from apps.products.models import Artist
        return Artist.objects.all()


# ── Users ─────────────────────────────────────────────────────────────────────

class AdminUserListView(AdminNoPaginationMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.users.serializers import UserSerializer
        return UserSerializer

    def get_queryset(self):
        from apps.users.models import User
        return User.objects.all().order_by("-date_joined")


class AdminUserToggleView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        from apps.users.models import User
        from apps.users.serializers import UserSerializer
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        action = "user_activate" if user.is_active else "user_deactivate"
        log_action(request.user, action, "User", user.pk, {"email": user.email})
        return Response({"id": str(user.pk), "is_active": user.is_active})


# ── Promo Codes ───────────────────────────────────────────────────────────────

class AdminPromoListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.promo.serializers import PromoCodeSerializer
        return PromoCodeSerializer

    def get_queryset(self):
        from apps.promo.models import PromoCode
        return PromoCode.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "promo_create", "PromoCode", instance.pk, {"code": instance.code})


class AdminPromoDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.promo.serializers import PromoCodeSerializer
        return PromoCodeSerializer

    def get_queryset(self):
        from apps.promo.models import PromoCode
        return PromoCode.objects.all()

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "promo_update", "PromoCode", instance.pk, {"code": instance.code})

    def perform_destroy(self, instance):
        log_action(self.request.user, "promo_delete", "PromoCode", instance.pk, {"code": instance.code})
        instance.delete()


# ── Reviews ───────────────────────────────────────────────────────────────────

class AdminHomepageReviewListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import HomepageReviewSerializer
        return HomepageReviewSerializer

    def get_queryset(self):
        from apps.cms.models import HomepageReview
        return HomepageReview.objects.all()


class AdminHomepageReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import HomepageReviewSerializer
        return HomepageReviewSerializer

    def get_queryset(self):
        from apps.cms.models import HomepageReview
        return HomepageReview.objects.all()


class AdminCommunitySocialLinkListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import CommunitySocialLinkSerializer
        return CommunitySocialLinkSerializer

    def get_queryset(self):
        from apps.cms.models import CommunitySocialLink
        return CommunitySocialLink.objects.all()


class AdminCommunitySocialLinkDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import CommunitySocialLinkSerializer
        return CommunitySocialLinkSerializer

    def get_queryset(self):
        from apps.cms.models import CommunitySocialLink
        return CommunitySocialLink.objects.all()


class AdminFAQListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import FAQSerializer
        return FAQSerializer

    def get_queryset(self):
        from apps.cms.models import FAQ
        qs = FAQ.objects.all()
        category = self.request.query_params.get("category")
        if category:
            return qs.filter(category=category)
        return qs


class AdminFAQDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import FAQSerializer
        return FAQSerializer

    def get_queryset(self):
        from apps.cms.models import FAQ
        return FAQ.objects.all()


class AdminReviewListView(AdminNoPaginationMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.products.serializers import ReviewSerializer
        return ReviewSerializer

    def get_queryset(self):
        from apps.products.models import Review
        return Review.objects.select_related("user", "product").all()


class AdminReviewApproveView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        from apps.products.models import Review
        from apps.products.serializers import ReviewSerializer
        try:
            review = Review.objects.get(pk=pk)
        except Review.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        review.approved = not review.approved
        review.save(update_fields=["approved"])
        return Response(ReviewSerializer(review).data)


# ── Auctions ──────────────────────────────────────────────────────────────────

class AdminAuctionListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.auctions.serializers import AuctionSerializer, AuctionWriteSerializer
        if self.request.method == "POST":
            return AuctionWriteSerializer
        return AuctionSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["include_all_bids"] = True
        return ctx

    def get_queryset(self):
        from apps.auctions.models import Auction
        return Auction.objects.prefetch_related("bids__user").select_related("product", "vendor", "winner").all()


class AdminAuctionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.auctions.serializers import AuctionSerializer, AuctionWriteSerializer
        if self.request.method in ("PUT", "PATCH"):
            return AuctionWriteSerializer
        return AuctionSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["include_all_bids"] = True
        return ctx

    def get_queryset(self):
        from apps.auctions.models import Auction
        return Auction.objects.prefetch_related("bids__user").select_related("product", "vendor", "winner").all()


# ── CMS (Hero / Banners) ──────────────────────────────────────────────────────

class AdminHeroListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import HeroSlideSerializer
        return HeroSlideSerializer

    def get_queryset(self):
        from apps.cms.models import HeroSlide
        return HeroSlide.objects.all()


class AdminHeroDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import HeroSlideSerializer
        return HeroSlideSerializer

    def get_queryset(self):
        from apps.cms.models import HeroSlide
        return HeroSlide.objects.all()


class AdminBannerListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import BannerSerializer
        return BannerSerializer

    def get_queryset(self):
        from apps.cms.models import Banner
        return Banner.objects.all()


class AdminBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.cms.serializers import BannerSerializer
        return BannerSerializer

    def get_queryset(self):
        from apps.cms.models import Banner
        return Banner.objects.all()


class AdminAnnouncementBarView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.cms.models import AnnouncementBar
        from apps.cms.serializers import AnnouncementBarSerializer
        bar, _ = AnnouncementBar.objects.get_or_create(
            pk=1,
            defaults={
                "messages": [
                    "FREE SHIPPING on orders over $49 — use code FREESHIP",
                    "LIMITED EDITIONS: New drops every Friday at noon",
                    "EARN XP with every purchase — unlock exclusive badges",
                ],
                "is_active": True,
            },
        )
        return Response(AnnouncementBarSerializer(bar).data)

    def patch(self, request):
        from apps.cms.models import AnnouncementBar
        from apps.cms.serializers import AnnouncementBarSerializer
        bar, _ = AnnouncementBar.objects.get_or_create(pk=1)
        ser = AnnouncementBarSerializer(bar, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


# ── Newsletter ────────────────────────────────────────────────────────────────

class AdminNewsletterListView(AdminNoPaginationMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        from apps.newsletter.models import NewsletterSubscriber
        return NewsletterSubscriber.objects.all().order_by("-subscribed_at")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = [{"email": s.email, "subscribed_at": s.subscribed_at} for s in qs]
        return Response({"count": len(data), "results": data})


# ── Inbox (Admin) ─────────────────────────────────────────────────────────────

class AdminConversationListView(AdminNoPaginationMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.messaging.serializers import ConversationSerializer
        return ConversationSerializer

    def get_queryset(self):
        from apps.messaging.models import Conversation
        return Conversation.objects.prefetch_related("messages").all()


# ── Settings ──────────────────────────────────────────────────────────────────

class AdminSettingsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.cms.models import SiteSettings
        settings = SiteSettings.objects.all()
        return Response({s.key: s.value for s in settings})

    def patch(self, request):
        from apps.cms.models import SiteSettings
        keys = []
        for key, value in request.data.items():
            SiteSettings.objects.update_or_create(key=key, defaults={"value": str(value)})
            keys.append(key)
        log_action(request.user, "settings_update", "SiteSettings", "global", {"keys": keys})
        return Response({"detail": "Settings updated."})


# ── Gamification ──────────────────────────────────────────────────────────────

class AdminBadgeListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.gamification.serializers import BadgeSerializer, BadgeWriteSerializer
        if self.request.method == "POST":
            return BadgeWriteSerializer
        return BadgeSerializer

    def get_queryset(self):
        from apps.gamification.models import Badge
        return Badge.objects.select_related("prize_promo").all()

    def create(self, request, *args, **kwargs):
        from apps.gamification.serializers import BadgeSerializer, BadgeWriteSerializer
        write_ser = BadgeWriteSerializer(data=request.data)
        write_ser.is_valid(raise_exception=True)
        badge = write_ser.save()
        badge = self.get_queryset().get(pk=badge.pk)
        return Response(BadgeSerializer(badge).data, status=status.HTTP_201_CREATED)


class AdminBadgeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.gamification.serializers import BadgeSerializer, BadgeWriteSerializer
        if self.request.method in ("PUT", "PATCH"):
            return BadgeWriteSerializer
        return BadgeSerializer

    def get_queryset(self):
        from apps.gamification.models import Badge
        return Badge.objects.select_related("prize_promo").all()

    def update(self, request, *args, **kwargs):
        from apps.gamification.serializers import BadgeSerializer, BadgeWriteSerializer
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        write_ser = BadgeWriteSerializer(instance, data=request.data, partial=partial)
        write_ser.is_valid(raise_exception=True)
        write_ser.save()
        instance = self.get_queryset().get(pk=instance.pk)
        return Response(BadgeSerializer(instance).data)


class AdminXPRuleListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.gamification.serializers import XPRuleSerializer
        return XPRuleSerializer

    def get_queryset(self):
        from apps.gamification.models import XPRule
        return XPRule.objects.all().order_by("action_key")


class AdminXPRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.gamification.serializers import XPRuleSerializer
        return XPRuleSerializer

    def get_queryset(self):
        from apps.gamification.models import XPRule
        return XPRule.objects.all()


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLogPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 500


class AdminAuditLogView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AuditLogPagination

    def get_queryset(self):
        qs = AuditLog.objects.select_related("admin_user").all()
        action = self.request.query_params.get("action")
        target_type = self.request.query_params.get("target_type")
        category = self.request.query_params.get("category")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        search = self.request.query_params.get("search", "").strip()

        if action:
            qs = qs.filter(action=action)
        if target_type:
            qs = qs.filter(target_type__iexact=target_type)
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(target_id__icontains=search)
                | Q(detail__icontains=search)
                | Q(admin_user__email__icontains=search)
            )
        if category:
            cat = category.lower()
            if cat == "order":
                qs = qs.filter(Q(target_type__iexact="Order") | Q(action__startswith="order"))
            elif cat == "payment":
                qs = qs.filter(Q(action__icontains="payment") | Q(target_type__iexact="CustomOrder"))
            elif cat == "product":
                qs = qs.filter(target_type__in=["Product", "ProductVariant"])
            elif cat == "settings":
                qs = qs.filter(Q(target_type__in=["SiteSettings", "Vendor"]) | Q(action="settings_update"))
            elif cat == "content":
                qs = qs.filter(target_type__in=["page_section", "blog_post", "HeroSlide", "Banner"])
        return qs


class AdminBlogPostSerializer(serializers.ModelSerializer):
    class Meta:
        from apps.blog.models import BlogPost
        model = BlogPost
        fields = (
            "id",
            "title",
            "slug",
            "excerpt",
            "content",
            "content_blocks",
            "cover_image_url",
            "is_published",
            "published_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")


class AdminBlogPostListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.blog.models import BlogPost
        posts = BlogPost.objects.all().order_by("-created_at")
        return Response(AdminBlogPostSerializer(posts, many=True).data)

    def post(self, request):
        payload = request.data.copy()
        if payload.get("is_published") and not payload.get("published_at"):
            payload["published_at"] = timezone.now()
        ser = AdminBlogPostSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        post = ser.save()
        log_action(request.user, "create", "blog_post", post.id, {"title": post.title})
        return Response(AdminBlogPostSerializer(post).data, status=status.HTTP_201_CREATED)


class AdminBlogPostDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        from apps.blog.models import BlogPost
        try:
            post = BlogPost.objects.get(pk=pk)
        except BlogPost.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminBlogPostSerializer(post).data)

    def patch(self, request, pk):
        from apps.blog.models import BlogPost
        try:
            post = BlogPost.objects.get(pk=pk)
        except BlogPost.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        payload = request.data.copy()
        if payload.get("is_published") and not post.published_at and not payload.get("published_at"):
            payload["published_at"] = timezone.now()
        ser = AdminBlogPostSerializer(post, data=payload, partial=True)
        ser.is_valid(raise_exception=True)
        updated = ser.save()
        log_action(request.user, "update", "blog_post", updated.id, {"title": updated.title})
        return Response(AdminBlogPostSerializer(updated).data)

    def delete(self, request, pk):
        from apps.blog.models import BlogPost
        try:
            post = BlogPost.objects.get(pk=pk)
        except BlogPost.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)
        title = post.title
        post.delete()
        log_action(request.user, "delete", "blog_post", pk, {"title": title})
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Delivery options ──────────────────────────────────────────────────────────

class AdminDeliveryOptionListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.orders.models import DeliveryOption
        from apps.orders.serializers import DeliveryOptionSerializer
        opts = DeliveryOption.objects.all()
        return Response(DeliveryOptionSerializer(opts, many=True).data)

    def post(self, request):
        from apps.orders.models import DeliveryOption
        from apps.orders.serializers import DeliveryOptionSerializer
        ser = DeliveryOptionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        opt = ser.save()
        return Response(DeliveryOptionSerializer(opt).data, status=status.HTTP_201_CREATED)


class AdminDeliveryOptionDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        from apps.orders.models import DeliveryOption
        from apps.orders.serializers import DeliveryOptionSerializer
        try:
            opt = DeliveryOption.objects.get(pk=pk)
        except DeliveryOption.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = DeliveryOptionSerializer(opt, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(DeliveryOptionSerializer(opt).data)

    def delete(self, request, pk):
        from apps.orders.models import DeliveryOption
        try:
            DeliveryOption.objects.get(pk=pk).delete()
        except DeliveryOption.DoesNotExist:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Processing options ─────────────────────────────────────────────────────────

class AdminProcessingOptionListView(APIView):
    permission_classes = [IsAdminOrVendor]

    def _vendor_from_request(self, request):
        from apps.vendors.models import Vendor
        slug = request.query_params.get("vendor") or request.data.get("vendor_slug")
        if slug:
            return Vendor.objects.filter(slug=slug).first()
        # If the user is a vendor admin, auto-resolve their vendor
        if hasattr(request.user, "vendor_profile"):
            return request.user.vendor_profile
        return None

    def get(self, request):
        from apps.orders.models import ProcessingOption
        from apps.orders.serializers import ProcessingOptionSerializer
        vendor = self._vendor_from_request(request)
        opts = ProcessingOption.objects.select_related("vendor").all()
        if vendor:
            opts = opts.filter(vendor=vendor)
        elif not request.user.is_staff:
            # Non-staff without a vendor — return empty
            opts = opts.none()
        return Response(ProcessingOptionSerializer(opts, many=True).data)

    def post(self, request):
        from apps.orders.models import ProcessingOption
        from apps.orders.serializers import ProcessingOptionSerializer
        from apps.vendors.models import Vendor
        from django.utils.text import slugify
        import uuid
        data = request.data.copy()
        vendor = self._vendor_from_request(request)
        slug = data.pop("vendor_slug", None)
        if not vendor and slug:
            vendor = Vendor.objects.filter(slug=slug).first()
        # Always set vendor (None if not found)
        data["vendor"] = vendor.id if vendor else None
        # Auto-generate slug from label if not provided
        if "slug" not in data or not data["slug"]:
            base = slugify(data.get("label", "option"))
            data["slug"] = base or str(uuid.uuid4())[:8]
        ser = ProcessingOptionSerializer(data=data)
        ser.is_valid(raise_exception=True)
        opt = ser.save()
        return Response(ProcessingOptionSerializer(opt).data, status=status.HTTP_201_CREATED)


class AdminProcessingOptionDetailView(APIView):
    permission_classes = [IsAdminOrVendor]

    def patch(self, request, pk):
        from apps.orders.models import ProcessingOption
        from apps.orders.serializers import ProcessingOptionSerializer
        try:
            opt = ProcessingOption.objects.get(pk=pk)
        except ProcessingOption.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = ProcessingOptionSerializer(opt, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ProcessingOptionSerializer(opt).data)

    def delete(self, request, pk):
        from apps.orders.models import ProcessingOption
        try:
            ProcessingOption.objects.get(pk=pk).delete()
        except ProcessingOption.DoesNotExist:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Size variants ──────────────────────────────────────────────────────────────

class AdminSizeVariantView(APIView):
    permission_classes = [IsAdminOrVendor]

    def post(self, request):
        from apps.products.models import Product, SizeVariant
        from apps.products.serializers import SizeVariantSerializer
        product_id = request.data.get("product_id")
        if not product_id:
            return Response({"detail": "product_id required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and hasattr(request.user, "vendor_profile"):
            if product.vendor_id != request.user.vendor_profile.id:
                return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SizeVariantSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        image_ids = ser.validated_data.pop("images", None)
        sv = SizeVariant.objects.create(product=product, **ser.validated_data)
        if image_ids is not None:
            sv.images.set(image_ids)
        return Response(SizeVariantSerializer(sv).data, status=status.HTTP_201_CREATED)

    def patch(self, request, sv_id):
        from apps.products.models import SizeVariant
        from apps.products.serializers import SizeVariantSerializer
        try:
            sv = SizeVariant.objects.get(pk=sv_id)
        except SizeVariant.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = SizeVariantSerializer(sv, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        image_ids = ser.validated_data.pop("images", None)
        ser.save()
        if image_ids is not None:
            sv.images.set(image_ids)
        return Response(SizeVariantSerializer(sv).data)

    def delete(self, request, sv_id):
        from apps.products.models import SizeVariant
        try:
            SizeVariant.objects.get(pk=sv_id).delete()
        except SizeVariant.DoesNotExist:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Product export / import ────────────────────────────────────────────────────

class AdminProductExportView(APIView):
    permission_classes = [IsAdminOrVendor]

    def get(self, request):
        try:
            import openpyxl
        except ImportError:
            return Response({"detail": "openpyxl not installed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        from apps.products.models import Product, SizeVariant
        from django.http import HttpResponse

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Products"
        headers = [
            "id", "title", "description", "material",
            "base_price_usd", "price_gel", "price_eur", "price_gbp",
            "categories", "allow_custom_size",
            "status", "is_limited", "is_sale", "is_new", "is_exclusive",
            "tags", "vendor_slug",
            "image_url_1", "image_url_2", "image_url_3",
            "size_1_label", "size_1_price_usd", "size_1_price_gel", "size_1_sale_usd", "size_1_sale_gel",
            "size_2_label", "size_2_price_usd", "size_2_price_gel", "size_2_sale_usd", "size_2_sale_gel",
            "size_3_label", "size_3_price_usd", "size_3_price_gel", "size_3_sale_usd", "size_3_sale_gel",
            "size_4_label", "size_4_price_usd", "size_4_price_gel", "size_4_sale_usd", "size_4_sale_gel",
            "size_5_label", "size_5_price_usd", "size_5_price_gel", "size_5_sale_usd", "size_5_sale_gel",
        ]
        ws.append(headers)

        products = Product.objects.prefetch_related("images", "size_variants", "categories", "vendor").filter(status="active")
        if not request.user.is_staff and hasattr(request.user, "vendor_profile"):
            products = products.filter(vendor=request.user.vendor_profile)
        for p in products:
            images = list(p.images.values_list("url", flat=True))[:3]
            while len(images) < 3:
                images.append("")
            svs = list(
                p.size_variants.filter(is_active=True).values_list(
                    "label", "price_usd", "price_gel", "sale_price_usd", "sale_price_gel"
                )
            )[:5]
            while len(svs) < 5:
                svs.append(("", "", "", "", ""))
            flat_svs = []
            for lbl, pr_usd, pr_gel, sale_usd, sale_gel in svs:
                flat_svs.extend([
                    lbl,
                    str(pr_usd) if pr_usd is not None else "",
                    str(pr_gel) if pr_gel is not None else "",
                    str(sale_usd) if sale_usd is not None else "",
                    str(sale_gel) if sale_gel is not None else "",
                ])
            rp = p.regional_prices or {}
            row = [
                p.id, p.title, p.description, p.material,
                str(p.base_price),
                str(rp.get("GEL", {}).get("price", "") or ""),
                str(rp.get("EUR", {}).get("price", "") or ""),
                str(rp.get("GBP", {}).get("price", "") or ""),
                ",".join(p.categories.values_list("slug", flat=True)),
                "yes" if p.allow_custom_size else "no",
                p.status,
                "yes" if p.is_limited else "no",
                "yes" if p.is_sale else "no",
                "yes" if p.is_new else "no",
                "yes" if p.is_exclusive else "no",
                ",".join(p.tags or []),
                p.vendor.slug if p.vendor else "",
            ] + images + flat_svs
            ws.append(row)

        from io import BytesIO
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        response = HttpResponse(
            buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="products_export.xlsx"'
        return response


class AdminProductImportView(APIView):
    permission_classes = [IsAdminOrVendor]

    def get(self, request):
        """Download blank template."""
        try:
            import openpyxl
        except ImportError:
            return Response({"detail": "openpyxl not installed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        from django.http import HttpResponse

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Products"
        headers = [
            "title", "description", "material",
            "base_price_usd", "price_gel", "price_eur", "price_gbp",
            "categories", "allow_custom_size",
            "status", "is_limited", "is_sale", "is_new", "is_exclusive",
            "tags", "vendor_slug",
            "image_url_1", "image_url_2", "image_url_3",
            "size_1_label", "size_1_price_usd", "size_1_price_gel", "size_1_sale_usd", "size_1_sale_gel",
            "size_2_label", "size_2_price_usd", "size_2_price_gel", "size_2_sale_usd", "size_2_sale_gel",
            "size_3_label", "size_3_price_usd", "size_3_price_gel", "size_3_sale_usd", "size_3_sale_gel",
            "size_4_label", "size_4_price_usd", "size_4_price_gel", "size_4_sale_usd", "size_4_sale_gel",
            "size_5_label", "size_5_price_usd", "size_5_price_gel", "size_5_sale_usd", "size_5_sale_gel",
        ]
        ws.append(headers)
        ws.append([
            "Example Product", "A beautiful piece.", "Canvas",
            "49.99", "135.00", "46.00", "39.50",
            "figures", "no",
            "active", "no", "yes", "yes", "no",
            "art,modern", "example-vendor",
            "https://example.com/img1.jpg", "", "",
            "S", "39.99", "108.00", "34.99", "95.00",
            "M", "49.99", "135.00", "44.99", "120.00",
            "L", "59.99", "162.00", "", "",
            "", "", "", "", "",
            "", "", "", "", "",
        ])
        from io import BytesIO
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        response = HttpResponse(
            buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="products_template.xlsx"'
        return response

    def post(self, request):
        """Import products from uploaded xlsx."""
        try:
            import openpyxl
        except ImportError:
            return Response({"detail": "openpyxl not installed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        from apps.products.models import Product, ProductImage, SizeVariant, Category
        from apps.vendors.models import Vendor

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file)
        except Exception as e:
            return Response({"detail": f"Invalid xlsx: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return Response({"detail": "Empty file."}, status=status.HTTP_400_BAD_REQUEST)

        headers = [str(h).strip().lower() if h else "" for h in rows[0]]
        data_rows = rows[1:]
        created_count = 0
        errors = []

        def cell(row, name):
            try:
                idx = headers.index(name)
                return row[idx] if idx < len(row) else None
            except ValueError:
                return None

        def yn(val):
            return str(val).strip().lower() in ("yes", "true", "1")

        for i, row in enumerate(data_rows, start=2):
            title = cell(row, "title")
            if not title:
                continue
            try:
                from decimal import Decimal as D
                base_price = D(str(cell(row, "base_price_usd") or "0"))
                regional_prices = {}
                for cur, col in [("GEL", "price_gel"), ("EUR", "price_eur"), ("GBP", "price_gbp")]:
                    v = cell(row, col)
                    if v:
                        regional_prices[cur] = {"price": str(v)}

                tags_raw = cell(row, "tags") or ""
                tags = [t.strip() for t in str(tags_raw).split(",") if str(t).strip()]

                vendor_slug = cell(row, "vendor_slug")
                vendor = Vendor.objects.filter(slug=vendor_slug).first() if vendor_slug else None
                if not vendor and not request.user.is_staff and hasattr(request.user, "vendor_profile"):
                    vendor = request.user.vendor_profile

                cat_raw = cell(row, "categories") or ""
                cat_slugs = [s.strip() for s in str(cat_raw).split(",") if str(s).strip()]
                cats = list(Category.objects.filter(slug__in=cat_slugs))
                primary_cat = cats[0] if cats else None

                product = Product.objects.create(
                    title=str(title),
                    description=str(cell(row, "description") or ""),
                    material=str(cell(row, "material") or ""),
                    base_price=base_price,
                    regional_prices=regional_prices,
                    allow_custom_size=yn(cell(row, "allow_custom_size")),
                    status=str(cell(row, "status") or "active"),
                    is_limited=yn(cell(row, "is_limited")),
                    is_sale=yn(cell(row, "is_sale")),
                    is_new=yn(cell(row, "is_new")),
                    is_exclusive=yn(cell(row, "is_exclusive")),
                    tags=tags,
                    category=primary_cat,
                    vendor=vendor,
                )
                if cats:
                    product.categories.set(cats)

                for n in range(1, 4):
                    url = cell(row, f"image_url_{n}")
                    if url:
                        ProductImage.objects.create(product=product, url=str(url), order=n - 1)

                for n in range(1, 6):
                    lbl = cell(row, f"size_{n}_label")
                    pr_usd = cell(row, f"size_{n}_price_usd") or cell(row, f"size_{n}_price")
                    pr_gel = cell(row, f"size_{n}_price_gel")
                    sale_usd = cell(row, f"size_{n}_sale_usd")
                    sale_gel = cell(row, f"size_{n}_sale_gel")
                    if lbl and pr_usd:
                        try:
                            SizeVariant.objects.create(
                                product=product,
                                label=str(lbl),
                                price_usd=D(str(pr_usd)),
                                price_gel=D(str(pr_gel)) if pr_gel else None,
                                sale_price_usd=D(str(sale_usd)) if sale_usd else None,
                                sale_price_gel=D(str(sale_gel)) if sale_gel else None,
                                sort_order=n - 1,
                            )
                        except Exception:
                            pass

                created_count += 1
            except Exception as e:
                errors.append({"row": i, "error": str(e)})

        return Response({"created": created_count, "errors": errors}, status=status.HTTP_200_OK)


# ── Catalog filter visibility ─────────────────────────────────────────────────

class AdminCatalogFilterConfigView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.products.models import CatalogFilterConfig, DEFAULT_VISIBLE_FILTERS
        from apps.products.filter_config import _apply_config

        merged_global = dict(DEFAULT_VISIBLE_FILTERS)
        categories: dict[str, dict] = {}
        for cfg in CatalogFilterConfig.objects.filter(vendor__isnull=True):
            if cfg.scope == "global":
                merged_global = _apply_config(merged_global, cfg)
            elif cfg.scope == "category" and cfg.category_slug:
                base = dict(DEFAULT_VISIBLE_FILTERS)
                categories[cfg.category_slug] = _apply_config(base, cfg)
        return Response({"global": merged_global, "categories": categories})

    def patch(self, request):
        from apps.products.models import CatalogFilterConfig

        scope = request.data.get("scope")
        category_slug = (request.data.get("category_slug") or "").strip()
        visible_filters = request.data.get("visible_filters", {})
        if scope not in ("global", "category"):
            return Response({"detail": "Invalid scope."}, status=status.HTTP_400_BAD_REQUEST)
        if scope == "category" and not category_slug:
            return Response({"detail": "category_slug required."}, status=status.HTTP_400_BAD_REQUEST)

        cfg, _ = CatalogFilterConfig.objects.update_or_create(
            scope=scope,
            category_slug=category_slug if scope == "category" else "",
            vendor=None,
            defaults={"visible_filters": visible_filters},
        )
        return Response(cfg.resolved_filters())


# ── Vendor ops (superadmin) ───────────────────────────────────────────────────

class AdminVendorOpsView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, slug):
        from apps.vendors.models import Vendor
        from apps.vendors.serializers import VendorSerializer
        try:
            vendor = Vendor.objects.get(slug=slug)
        except Vendor.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        allowed = (
            "payment_email", "gift_wrap_price_gel", "gift_wrap_price_usd",
            "shipping_email_subject", "shipping_email_body",
        )
        for field in allowed:
            if field in request.data:
                setattr(vendor, field, request.data[field])
        vendor.save()
        log_action(request.user, "vendor_ops_update", "Vendor", vendor.pk, {"vendor_slug": slug})
        return Response(VendorSerializer(vendor).data)


# ── Vendor bulk sale ──────────────────────────────────────────────────────────

class AdminVendorBulkSaleView(APIView):
    """Apply a percentage sale to all active SizeVariants of a vendor's products."""
    permission_classes = [IsAdminUser]

    def post(self, request, slug):
        from apps.vendors.models import Vendor
        from apps.products.models import SizeVariant, Product
        from decimal import Decimal, ROUND_HALF_UP

        try:
            vendor = Vendor.objects.get(slug=slug)
        except Vendor.DoesNotExist:
            return Response({"detail": "Vendor not found."}, status=status.HTTP_404_NOT_FOUND)

        discount_pct = request.data.get("discount_pct")
        currency = request.data.get("currency", "both")  # "GEL", "USD", or "both"

        if discount_pct is None:
            return Response({"detail": "discount_pct is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            pct = Decimal(str(discount_pct))
            if pct <= 0 or pct >= 100:
                raise ValueError
        except (ValueError, Exception):
            return Response({"detail": "discount_pct must be between 1 and 99."}, status=status.HTTP_400_BAD_REQUEST)

        multiplier = (Decimal("100") - pct) / Decimal("100")

        products = Product.objects.filter(vendor=vendor, status="active")
        updated_count = 0
        for product in products:
            product.is_sale = True
            product.save(update_fields=["is_sale"])
            svs = SizeVariant.objects.filter(product=product, is_active=True)
            for sv in svs:
                if currency in ("USD", "both") and sv.price_usd:
                    sv.sale_price_usd = (sv.price_usd * multiplier).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if currency in ("GEL", "both") and sv.price_gel:
                    sv.sale_price_gel = (sv.price_gel * multiplier).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                sv.save(update_fields=["sale_price_usd", "sale_price_gel"])
                updated_count += 1

        log_action(request.user, "vendor_bulk_sale", "Vendor", vendor.pk, {
            "vendor": vendor.name, "discount_pct": str(pct), "currency": currency,
            "variants_updated": updated_count,
        })
        return Response({"detail": f"Sale applied to {updated_count} variants.", "variants_updated": updated_count})

    def delete(self, request, slug):
        """Remove sale from all vendor products."""
        from apps.vendors.models import Vendor
        from apps.products.models import SizeVariant, Product

        try:
            vendor = Vendor.objects.get(slug=slug)
        except Vendor.DoesNotExist:
            return Response({"detail": "Vendor not found."}, status=status.HTTP_404_NOT_FOUND)

        products = Product.objects.filter(vendor=vendor)
        for product in products:
            product.is_sale = False
            product.save(update_fields=["is_sale"])
            SizeVariant.objects.filter(product=product).update(sale_price_usd=None, sale_price_gel=None)

        return Response({"detail": "Sale removed from all vendor products."})


# ── Page sections CMS ─────────────────────────────────────────────────────────

class AdminPageSectionListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.cms.models import PageSection
        from apps.cms.serializers import PageSectionSerializer
        page = request.query_params.get("page")
        qs = PageSection.objects.all().order_by("page", "sort_order")
        if page:
            qs = qs.filter(page=page)
        return Response(PageSectionSerializer(qs, many=True).data)

    def post(self, request):
        from apps.cms.models import PageSection
        from apps.cms.serializers import PageSectionSerializer
        ser = PageSectionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        section = ser.save()
        log_action(request.user, "create", "page_section", section.pk, {
            "section_key": section.section_key,
            "page": section.page,
        })
        return Response(PageSectionSerializer(section).data, status=status.HTTP_201_CREATED)


class AdminPageSectionDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        from apps.cms.models import PageSection
        from apps.cms.serializers import PageSectionSerializer
        try:
            section = PageSection.objects.get(pk=pk)
        except PageSection.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = PageSectionSerializer(section, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        section = ser.save()
        log_action(request.user, "update", "page_section", section.pk, {
            "section_key": section.section_key,
            "page": section.page,
        })
        return Response(PageSectionSerializer(section).data)

    def delete(self, request, pk):
        from apps.cms.models import PageSection
        try:
            section = PageSection.objects.get(pk=pk)
        except PageSection.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        log_action(request.user, "delete", "page_section", section.pk, {
            "section_key": section.section_key,
            "page": section.page,
        })
        section.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
