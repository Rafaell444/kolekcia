from rest_framework import serializers
from .models import Auction, AuctionBid


class AuctionBidSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuctionBid
        fields = ("id", "user_name", "amount", "placed_at")

    def get_user_name(self, obj):
        return obj.user.name or obj.user.email.split("@")[0]


class AuctionSerializer(serializers.ModelSerializer):
    current_bid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    bid_count = serializers.IntegerField(read_only=True)
    top_bidder = serializers.CharField(read_only=True)
    recent_bids = serializers.SerializerMethodField()
    effective_image = serializers.SerializerMethodField()
    product_title = serializers.SerializerMethodField()
    product_slug = serializers.SerializerMethodField()
    is_ended = serializers.SerializerMethodField()

    class Meta:
        model = Auction
        fields = (
            "id",
            "title",
            "artist_name",
            "image_url",
            "effective_image",
            "product_title",
            "product_slug",
            "starting_bid",
            "current_bid",
            "bid_count",
            "top_bidder",
            "ends_at",
            "is_live",
            "is_ended",
            "recent_bids",
        )

    def get_effective_image(self, obj):
        if obj.image_url:
            return obj.image_url
        if obj.product:
            img = obj.product.images.first()
            if img:
                return img.url
        return None

    def get_product_title(self, obj):
        return obj.product.title if obj.product else obj.title

    def get_product_slug(self, obj):
        return obj.product.slug if obj.product else None

    def get_is_ended(self, obj):
        from django.utils import timezone
        return obj.ends_at <= timezone.now()

    def get_recent_bids(self, obj):
        bids = obj.bids.order_by("-placed_at")[:10]
        return AuctionBidSerializer(bids, many=True).data


class PlaceBidSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
