from rest_framework import serializers
from django.utils import timezone
from .models import Auction, AuctionBid, AuctionChatMessage
from apps.core.serializers import build_seo_dict


class AuctionBidSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = AuctionBid
        fields = ("id", "user_name", "user_email", "amount", "placed_at")

    def get_user_name(self, obj):
        return obj.user.name or obj.user.email.split("@")[0]

    def get_user_email(self, obj):
        return obj.user.email


class AuctionChatMessageSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuctionChatMessage
        fields = ("id", "user_name", "text", "created_at")

    def get_user_name(self, obj):
        return obj.user.name or obj.user.email.split("@")[0]


class AuctionSerializer(serializers.ModelSerializer):
    current_bid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    bid_count = serializers.IntegerField(read_only=True)
    top_bidder = serializers.CharField(read_only=True)
    recent_bids = serializers.SerializerMethodField()
    all_bids = serializers.SerializerMethodField()
    effective_image = serializers.SerializerMethodField()
    product_title = serializers.SerializerMethodField()
    product_slug = serializers.SerializerMethodField()
    product_id = serializers.IntegerField(source="product.id", read_only=True, allow_null=True)
    vendor_id = serializers.IntegerField(source="vendor.id", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)
    is_ended = serializers.SerializerMethodField()
    is_upcoming = serializers.SerializerMethodField()
    is_biddable = serializers.SerializerMethodField()
    winner_name = serializers.SerializerMethodField()

    seo = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()

    class Meta:
        model = Auction
        fields = (
            "id",
            "slug",
            "title",
            "artist_name",
            "image_url",
            "effective_image",
            "product_id",
            "product_title",
            "product_slug",
            "vendor_id",
            "vendor_name",
            "starting_bid",
            "current_bid",
            "bid_count",
            "top_bidder",
            "starts_at",
            "ends_at",
            "status",
            "is_live",
            "is_ended",
            "is_upcoming",
            "is_biddable",
            "winner",
            "winner_name",
            "winning_amount",
            "winner_payment_status",
            "paid_at",
            "recent_bids",
            "all_bids",
            "created_at",
            "seo",
            "breadcrumbs",
        )

    def get_seo(self, obj):
        return build_seo_dict(obj, og_image=obj.image_url or "")

    def get_breadcrumbs(self, obj):
        return [
            {"name": "Home", "url": "/"},
            {"name": "Auctions", "url": "/auctions"},
            {"name": obj.title or "", "url": f"/auctions/{obj.id}"},
        ]

    def get_effective_image(self, obj):
        if obj.image_url:
            return obj.image_url
        if obj.product:
            img = obj.product.images.first()
            if img:
                return img.url or (img.video_file.url if img.video_file else "")
        return None

    def get_product_title(self, obj):
        return obj.product.title if obj.product else obj.title

    def get_product_slug(self, obj):
        return obj.product.slug if obj.product else None

    def get_is_ended(self, obj):
        return obj.is_ended()

    def get_is_upcoming(self, obj):
        return obj.is_upcoming()

    def get_is_biddable(self, obj):
        return obj.is_biddable()

    def get_winner_name(self, obj):
        if not obj.winner_id:
            return None
        return obj.winner.name or obj.winner.email.split("@")[0]

    def get_recent_bids(self, obj):
        bids = obj.bids.order_by("-placed_at")[:10]
        return AuctionBidSerializer(bids, many=True).data

    def get_all_bids(self, obj):
        if not self.context.get("include_all_bids"):
            return None
        bids = obj.bids.select_related("user").order_by("-placed_at")
        return AuctionBidSerializer(bids, many=True).data


class AuctionWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Auction
        fields = (
            "id",
            "product_id",
            "title",
            "artist_name",
            "image_url",
            "starting_bid",
            "starts_at",
            "ends_at",
            "status",
            "winner_payment_status",
            "winning_amount",
            "paid_at",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "End time must be after start time."})
        return attrs

    def create(self, validated_data):
        product_id = validated_data.pop("product_id", None)
        auction = Auction(**validated_data)
        if product_id:
            from apps.products.models import Product
            product = Product.objects.select_related("artist").get(pk=product_id)
            auction.product = product
            auction.title = product.title
            if product.artist:
                auction.artist_name = product.artist.name
            img = product.images.first()
            if img and not auction.image_url:
                auction.image_url = img.url or (img.video_file.url if img.video_file else "")
        vendor = self.context.get("vendor")
        if vendor:
            auction.vendor = vendor
        auction.save()
        return auction

    def update(self, instance, validated_data):
        product_id = validated_data.pop("product_id", None)
        if product_id is not None:
            from apps.products.models import Product
            if product_id:
                product = Product.objects.select_related("artist").prefetch_related("images").get(pk=product_id)
                instance.product = product
                instance.title = product.title
                if product.artist:
                    instance.artist_name = product.artist.name
            else:
                instance.product = None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if validated_data.get("winner_payment_status") == Auction.PAYMENT_PAID and not instance.paid_at:
            instance.paid_at = timezone.now()
            instance.status = Auction.STATUS_BOUGHT
        instance.save()
        return instance


class PlaceBidSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)


class AuctionChatPostSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500)
