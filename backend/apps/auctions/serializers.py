from decimal import Decimal

from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import Auction, AuctionBid, AuctionChatMessage
from apps.core.serializers import build_seo_dict


class AuctionBidSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    amount_usd = serializers.DecimalField(source="amount", max_digits=10, decimal_places=2, read_only=True)
    amount_gel = serializers.SerializerMethodField()

    class Meta:
        model = AuctionBid
        fields = (
            "id", "user_id", "user_name", "user_email", "amount", "amount_usd", "amount_gel", "placed_at",
            "submitted_amount", "submitted_currency", "fx_rate_used",
            "is_disqualified", "disqualified_at", "disqualification_reason",
        )

    def get_user_name(self, obj):
        return obj.user.name or obj.user.email.split("@")[0]

    def get_amount_gel(self, obj):
        from .services import get_usd_gel_rate, usd_to_gel

        rate = self.context.get("usd_gel_rate")
        if rate is None:
            rate = get_usd_gel_rate()
        converted = usd_to_gel(obj.amount, rate) if rate else None
        return str(converted) if converted is not None else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get("include_bidder_private_data"):
            data.pop("user_id", None)
            data.pop("user_email", None)
            data.pop("submitted_amount", None)
            data.pop("submitted_currency", None)
            data.pop("fx_rate_used", None)
            data.pop("is_disqualified", None)
            data.pop("disqualified_at", None)
            data.pop("disqualification_reason", None)
        return data


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
    vendor_slug = serializers.SerializerMethodField()
    is_ended = serializers.SerializerMethodField()
    is_upcoming = serializers.SerializerMethodField()
    is_biddable = serializers.SerializerMethodField()
    winner_name = serializers.SerializerMethodField()
    reserved_variant_label = serializers.CharField(
        source="reserved_size_variant.label", read_only=True, allow_null=True
    )
    starting_bid_usd = serializers.DecimalField(source="starting_bid", max_digits=10, decimal_places=2, read_only=True)
    starting_bid_gel = serializers.SerializerMethodField()
    current_bid_usd = serializers.SerializerMethodField()
    current_bid_gel = serializers.SerializerMethodField()
    minimum_bid_increment_usd = serializers.SerializerMethodField()
    minimum_bid_increment_gel = serializers.SerializerMethodField()
    usd_gel_rate = serializers.SerializerMethodField()

    seo = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()

    class Meta:
        model = Auction
        fields = (
            "id",
            "slug",
            "title",
            "title_en",
            "title_ka",
            "artist_name",
            "image_url",
            "effective_image",
            "product_id",
            "reserved_size_variant",
            "reserved_variant_label",
            "inventory_reserved",
            "product_title",
            "product_slug",
            "vendor_id",
            "vendor_name",
            "vendor_slug",
            "starting_bid",
            "starting_bid_usd",
            "starting_bid_gel",
            "current_bid_usd",
            "current_bid_gel",
            "minimum_bid_increment_usd",
            "minimum_bid_increment_gel",
            "usd_gel_rate",
            "shipping_price_gel",
            "shipping_price_usd",
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
            "winner_name",
            "winning_amount",
            "winner_payment_status",
            "is_replacement_winner",
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

    def get_vendor_slug(self, obj):
        if obj.vendor_id:
            return obj.vendor.slug
        if obj.product_id and obj.product.vendor_id:
            return obj.product.vendor.slug
        return None

    def _usd_gel_rate(self):
        if not hasattr(self, "_auction_fx_rate"):
            from .services import get_usd_gel_rate

            self._auction_fx_rate = self.context.get("usd_gel_rate") or get_usd_gel_rate()
        return self._auction_fx_rate

    def _gel_value(self, amount):
        from .services import usd_to_gel

        rate = self._usd_gel_rate()
        converted = usd_to_gel(amount, rate) if rate else None
        return str(converted) if converted is not None else None

    def get_starting_bid_gel(self, obj):
        return self._gel_value(obj.starting_bid)

    def get_current_bid_usd(self, obj):
        return str(obj.current_bid)

    def get_current_bid_gel(self, obj):
        return self._gel_value(obj.current_bid)

    def get_minimum_bid_increment_usd(self, obj):
        return "1.00"

    def get_minimum_bid_increment_gel(self, obj):
        return self._gel_value("1.00")

    def get_usd_gel_rate(self, obj):
        rate = self._usd_gel_rate()
        return str(rate) if rate is not None else None

    def get_recent_bids(self, obj):
        bids = obj.bids.filter(is_disqualified=False).order_by("-placed_at")[:10]
        context = {**self.context, "usd_gel_rate": self._usd_gel_rate()}
        return AuctionBidSerializer(bids, many=True, context=context).data

    def get_all_bids(self, obj):
        if not self.context.get("include_all_bids"):
            return None
        bids = obj.bids.select_related("user").order_by("is_disqualified", "-amount", "-placed_at")
        context = {**self.context, "usd_gel_rate": self._usd_gel_rate()}
        return AuctionBidSerializer(bids, many=True, context=context).data


class AuctionWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    reserved_size_variant_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Auction
        fields = (
            "id",
            "product_id",
            "reserved_size_variant_id",
            "title",
            "title_en",
            "title_ka",
            "artist_name",
            "image_url",
            "starting_bid",
            "shipping_price_gel",
            "shipping_price_usd",
            "starts_at",
            "ends_at",
            "status",
            "winner_payment_status",
            "winning_amount",
            "paid_at",
        )
        read_only_fields = ("id", "inventory_reserved", "is_replacement_winner")

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "End time must be after start time."})
        starting_bid = attrs.get("starting_bid", getattr(self.instance, "starting_bid", None))
        if starting_bid is not None and starting_bid <= 0:
            raise serializers.ValidationError({"starting_bid": "Minimum starting bid must be greater than zero."})
        for field in ("shipping_price_gel", "shipping_price_usd"):
            value = attrs.get(field, getattr(self.instance, field, 0))
            if value is not None and value < 0:
                raise serializers.ValidationError({field: "Shipping price cannot be negative."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        product_id = validated_data.pop("product_id", None)
        size_variant_id = validated_data.pop("reserved_size_variant_id", None)
        auction = Auction(**validated_data)
        if product_id:
            from apps.products.models import Product
            products = Product.objects.select_related("artist").filter(pk=product_id)
            vendor = self.context.get("vendor")
            if vendor:
                products = products.filter(vendor=vendor)
            product = products.get()
            auction.product = product
            auction.vendor = product.vendor
            auction.title = product.title
            auction.title_en = getattr(product, "title_en", "") or product.title
            auction.title_ka = getattr(product, "title_ka", "") or ""
            if product.artist:
                auction.artist_name = product.artist.name
            img = product.images.first()
            if img and not auction.image_url:
                auction.image_url = img.url or (img.video_file.url if img.video_file else "")
        elif not getattr(auction, "title_en", ""):
            auction.title_en = auction.title
        vendor = self.context.get("vendor")
        if vendor:
            auction.vendor = vendor
        auction.save()
        if auction.status == Auction.STATUS_ACTIVE:
            from .services import reserve_auction_inventory
            reserve_auction_inventory(auction, size_variant_id)
            _notify_auction_subscribers(auction)
        return auction

    @transaction.atomic
    def update(self, instance, validated_data):
        product_id = validated_data.pop("product_id", None)
        size_variant_id = validated_data.pop("reserved_size_variant_id", None)
        was_inactive = instance.status == Auction.STATUS_INACTIVE
        old_product_id = instance.product_id
        if product_id is not None:
            from apps.products.models import Product
            if product_id:
                products = Product.objects.select_related("artist").prefetch_related("images").filter(pk=product_id)
                vendor = self.context.get("vendor")
                if vendor:
                    products = products.filter(vendor=vendor)
                product = products.get()
                instance.product = product
                instance.vendor = product.vendor
                instance.title = product.title
                instance.title_en = getattr(product, "title_en", "") or product.title
                instance.title_ka = getattr(product, "title_ka", "") or ""
                if product.artist:
                    instance.artist_name = product.artist.name
            else:
                instance.product = None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if instance.product_id:
            product = instance.product
            instance.title = product.title
            instance.title_en = getattr(product, "title_en", "") or product.title
            instance.title_ka = getattr(product, "title_ka", "") or ""
        elif not getattr(instance, "title_en", ""):
            instance.title_en = instance.title
        if validated_data.get("winner_payment_status") == Auction.PAYMENT_PAID and not instance.paid_at:
            instance.paid_at = timezone.now()
            instance.status = Auction.STATUS_BOUGHT
        from .services import release_auction_inventory, reserve_auction_inventory
        becomes_inactive = instance.status == Auction.STATUS_INACTIVE
        inventory_selection_changed = (
            old_product_id != instance.product_id
            or (size_variant_id and size_variant_id != instance.reserved_size_variant_id)
        )
        if instance.inventory_reserved and (becomes_inactive or inventory_selection_changed):
            if instance.bids.exists():
                raise serializers.ValidationError({
                    "status": "An auction with bids cannot release or change its reserved inventory."
                })
            release_auction_inventory(instance)
        instance.save()
        if instance.status == Auction.STATUS_ACTIVE and instance.product_id and not instance.inventory_reserved:
            reserve_auction_inventory(instance, size_variant_id)
        if was_inactive and instance.status == Auction.STATUS_ACTIVE:
            _notify_auction_subscribers(instance)
        return instance


def _notify_auction_subscribers(auction) -> None:
    try:
        from apps.emails.service import send_to_auction_subscribers

        send_to_auction_subscribers(auction)
    except Exception:
        pass


class PlaceBidSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"))
    currency = serializers.ChoiceField(choices=("USD", "GEL"), default="USD", required=False)


class AuctionChatPostSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500)
