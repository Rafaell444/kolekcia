from django.contrib.auth import authenticate
from django.db.models import Sum, Count, Q
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
        from django.db.models.functions import TruncMonth

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
