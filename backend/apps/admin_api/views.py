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

from .permissions import IsAdminUser
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
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.orders.serializers import OrderSerializer
        return OrderSerializer

    def get_queryset(self):
        from apps.orders.models import Order
        return Order.objects.prefetch_related("items", "status_history").all()


class AdminOrderUpdateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        from apps.orders.models import Order
        from apps.orders.serializers import OrderSerializer
        try:
            order = Order.objects.prefetch_related("items", "status_history").get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)

    def patch(self, request, pk):
        from apps.orders.models import Order, OrderStatusHistory
        from apps.orders.serializers import OrderSerializer
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        note = request.data.get("note", "")
        tracking = request.data.get("tracking_code")

        if new_status:
            order.status = new_status
            OrderStatusHistory.objects.create(order=order, status=new_status, note=note, changed_by=request.user)
            log_action(request.user, "order_status_change", "Order", order.pk, {"new_status": new_status})

        if tracking is not None:
            order.tracking_code = tracking

        order.save()
        return Response(OrderSerializer(order).data)


# ── Products ──────────────────────────────────────────────────────────────────

class AdminProductListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.products.serializers import ProductDetailSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        from apps.products.models import Product
        return Product.objects.select_related("artist", "category").prefetch_related("images", "variants__size", "variants__finish", "variants__frame")


class AdminProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.products.serializers import ProductDetailSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        from apps.products.models import Product
        return Product.objects.select_related("artist", "category").prefetch_related("images", "variants__size", "variants__finish", "variants__frame")

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

        new_stock = request.data.get("stock")
        if new_stock is None:
            return Response({"detail": "stock is required."}, status=status.HTTP_400_BAD_REQUEST)

        old_stock = variant.stock
        variant.stock = int(new_stock)
        variant.save(update_fields=["stock"])
        log_action(request.user, "stock_update", "ProductVariant", variant.pk, {
            "product": variant.product.title, "old_stock": old_stock, "new_stock": variant.stock
        })
        return Response({"id": variant.pk, "stock": variant.stock})


# ── Categories ────────────────────────────────────────────────────────────────

class AdminCategoryListView(AdminNoPaginationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        from apps.products.serializers import CategorySerializer
        return CategorySerializer

    def get_queryset(self):
        from apps.products.models import Category
        return Category.objects.all()


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]

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
