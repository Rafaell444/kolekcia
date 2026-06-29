from rest_framework import serializers
from .models import Auction, AuctionBid


class AuctionBidSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = AuctionBid
        fields = ("id", "user_name", "amount", "placed_at")


class AuctionSerializer(serializers.ModelSerializer):
    current_bid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    bid_count = serializers.IntegerField(read_only=True)
    top_bidder = serializers.CharField(read_only=True)
    recent_bids = serializers.SerializerMethodField()

    class Meta:
        model = Auction
        fields = (
            "id", "title", "artist_name", "image_url",
            "starting_bid", "current_bid", "bid_count", "top_bidder",
            "ends_at", "is_live", "recent_bids",
        )

    def get_recent_bids(self, obj):
        bids = obj.bids.order_by("-placed_at")[:10]
        return AuctionBidSerializer(bids, many=True).data


class PlaceBidSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
