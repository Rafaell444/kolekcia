from django.contrib.auth import authenticate
from django.db.models import Sum, Count, Q, Max
from django.db.models.functions import TruncMonth, TruncDate
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsAdminUser, IsAdminOrVendor
from .models import AuditLog


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


def log_action(admin_user, action, target_type, target_id, detail=None):
    AuditLog.objects.create(
        admin_user=admin_user,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        detail=detail or {},
    )


# ── Serializers ──────────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    admin_email = serializers.CharField(source="admin_user.email", read_only=True, allow_null=True)

    class Meta:
        model = AuditLog
        fields = ("id", "admin_email", "action", "target_type", "target_id", "detail", "timestamp")


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
            log_action(request.user, "order_status_change", "Order", order.pk, {"new_status": new_status})

        if tracking is not None:
            order.tracking_code = tracking

        order.save()

        # Send shipping confirmation email when status moves to "shipped"
        if new_status == "shipped" and prev_status != "shipped":
            _send_shipping_email(order)

        return Response(OrderSerializer(order).data)


def _send_shipping_email(order):
    """Send a shipping confirmation email to the customer."""
    try:
        from django.core.mail import send_mail
        from django.conf import settings

        tracking_info = (
            f"\n\nTracking number: {order.tracking_code}"
            if order.tracking_code else ""
        )
        items_list = "\n".join(
            f"  • {item.product_title} × {item.quantity}"
            for item in order.items.all()
        )
        body = (
            f"Hi {order.shipping_name},\n\n"
            f"Great news — your Kolekcia order {order.order_number} has been shipped!{tracking_info}\n\n"
            f"Items in your order:\n{items_list}\n\n"
            f"Shipping to:\n"
            f"  {order.shipping_line1}"
            + (f", {order.shipping_line2}" if order.shipping_line2 else "")
            + f"\n  {order.shipping_city}, {order.shipping_state} {order.shipping_zip}\n"
            f"  {order.shipping_country}\n\n"
            f"Thank you for shopping with Kolekcia!\n"
            f"— The Kolekcia Team"
        )
        send_mail(
            subject=f"Your order {order.order_number} has shipped!",
            message=body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@kolekcia.com"),
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
        from apps.auctions.serializers import AuctionSerializer
        return AuctionSerializer

    def get_queryset(self):
        from apps.auctions.models import Auction
        return Auction.objects.prefetch_related("bids__user").all()


class AdminAuctionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.auctions.serializers import AuctionSerializer
        return AuctionSerializer

    def get_queryset(self):
        from apps.auctions.models import Auction
        return Auction.objects.prefetch_related("bids__user").all()


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
        for key, value in request.data.items():
            SiteSettings.objects.update_or_create(key=key, defaults={"value": str(value)})
        return Response({"detail": "Settings updated."})


# ── Gamification ──────────────────────────────────────────────────────────────

class AdminBadgeListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.gamification.serializers import BadgeSerializer
        return BadgeSerializer

    def get_queryset(self):
        from apps.gamification.models import Badge
        return Badge.objects.all()


class AdminXPRuleListView(AdminNoPaginationMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        from apps.gamification.models import XPRule
        return XPRule.objects.all()

    def list(self, request, *args, **kwargs):
        from apps.gamification.models import XPRule
        rules = XPRule.objects.all()
        data = [{"id": r.pk, "action_key": r.action_key, "xp_amount": r.xp_amount, "is_one_time": r.is_one_time} for r in rules]
        return Response(data)


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AdminAuditLogView(AdminNoPaginationMixin, generics.ListAPIView):
    queryset = AuditLog.objects.select_related("admin_user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]


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
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.orders.models import ProcessingOption
        from apps.orders.serializers import ProcessingOptionSerializer
        opts = ProcessingOption.objects.all()
        return Response(ProcessingOptionSerializer(opts, many=True).data)

    def post(self, request):
        from apps.orders.models import ProcessingOption
        from apps.orders.serializers import ProcessingOptionSerializer
        ser = ProcessingOptionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        opt = ser.save()
        return Response(ProcessingOptionSerializer(opt).data, status=status.HTTP_201_CREATED)


class AdminProcessingOptionDetailView(APIView):
    permission_classes = [IsAdminUser]

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
        sv = SizeVariant.objects.create(product=product, **ser.validated_data)
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
        ser.save()
        return Response(ser.data)

    def delete(self, request, sv_id):
        from apps.products.models import SizeVariant
        try:
            SizeVariant.objects.get(pk=sv_id).delete()
        except SizeVariant.DoesNotExist:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Product export / import ────────────────────────────────────────────────────

class AdminProductExportView(APIView):
    permission_classes = [IsAdminUser]

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
            "size_1_label", "size_1_price",
            "size_2_label", "size_2_price",
            "size_3_label", "size_3_price",
            "size_4_label", "size_4_price",
            "size_5_label", "size_5_price",
        ]
        ws.append(headers)

        products = Product.objects.prefetch_related("images", "size_variants", "categories", "vendor").filter(status="active")
        for p in products:
            images = list(p.images.values_list("url", flat=True))[:3]
            while len(images) < 3:
                images.append("")
            svs = list(p.size_variants.filter(is_active=True).values_list("label", "price_usd"))[:5]
            while len(svs) < 5:
                svs.append(("", ""))
            flat_svs = []
            for lbl, pr in svs:
                flat_svs.extend([lbl, str(pr) if pr is not None else ""])
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
    permission_classes = [IsAdminUser]

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
            "size_1_label", "size_1_price",
            "size_2_label", "size_2_price",
            "size_3_label", "size_3_price",
            "size_4_label", "size_4_price",
            "size_5_label", "size_5_price",
        ]
        ws.append(headers)
        # Add an example row
        ws.append([
            "Example Product", "A beautiful piece.", "Canvas",
            "49.99", "135.00", "46.00", "39.50",
            "figures", "no",
            "active", "no", "no", "yes", "no",
            "art,modern", "example-vendor",
            "https://example.com/img1.jpg", "", "",
            "S", "39.99", "M", "49.99", "L", "59.99", "", "", "", "",
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
                    pr = cell(row, f"size_{n}_price")
                    if lbl and pr:
                        try:
                            SizeVariant.objects.create(
                                product=product,
                                label=str(lbl),
                                price_usd=D(str(pr)),
                                sort_order=n - 1,
                            )
                        except Exception:
                            pass

                created_count += 1
            except Exception as e:
                errors.append({"row": i, "error": str(e)})

        return Response({"created": created_count, "errors": errors}, status=status.HTTP_200_OK)
