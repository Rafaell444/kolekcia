from rest_framework import serializers
from .models import Category, Artist, Product, ProductImage, ProductVariant, PosterSize, PosterFinish, PosterFrame, Review, WishlistItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "image_url", "count")


class ArtistSerializer(serializers.ModelSerializer):
    vendor_id   = serializers.IntegerField(source="vendor.id", read_only=True, allow_null=True)
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)

    class Meta:
        model = Artist
        fields = (
            "id", "name", "handle", "avatar_url", "cover_url", "bio",
            "designs", "followers", "level", "badge", "verified",
            "vendor_id", "vendor_slug", "vendor_name",
        )


class PosterSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PosterSize
        fields = ("id", "label", "surcharge")


class PosterFinishSerializer(serializers.ModelSerializer):
    class Meta:
        model = PosterFinish
        fields = ("id", "label", "surcharge")


class PosterFrameSerializer(serializers.ModelSerializer):
    class Meta:
        model = PosterFrame
        fields = ("id", "label", "surcharge")


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ("id", "url", "order")


class ProductVariantSerializer(serializers.ModelSerializer):
    size = PosterSizeSerializer()
    finish = PosterFinishSerializer()
    frame = PosterFrameSerializer()
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ProductVariant
        fields = ("id", "size", "finish", "frame", "stock", "surcharge", "price")


class ProductListSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(read_only=True)
    artist_name = serializers.CharField(source="artist.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    image_url = serializers.SerializerMethodField()
    default_variant_id = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id", "slug", "title", "artist_name", "category_slug", "image_url",
            "base_price", "original_price", "rating", "review_count",
            "is_limited", "is_sale", "is_new", "is_exclusive", "tags",
            "default_variant_id",
        )

    def get_image_url(self, obj):
        first = obj.images.first()
        return first.url if first else ""

    def get_default_variant_id(self, obj):
        first = obj.variants.first()
        return first.id if first else None


class ProductDetailSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(read_only=True)
    artist = ArtistSerializer()
    artist_name = serializers.CharField(source="artist.name", read_only=True)
    category = CategorySerializer()
    category_slug = serializers.CharField(source="category.slug", read_only=True, allow_null=True)
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    vendor_id = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True)
    variants = ProductVariantSerializer(many=True)
    sizes = serializers.SerializerMethodField()
    finishes = serializers.SerializerMethodField()
    frames = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id", "slug", "title", "artist", "artist_name", "category", "category_slug", "category_name",
            "vendor_id", "images", "variants",
            "base_price", "original_price", "rating", "review_count",
            "is_limited", "is_sale", "is_new", "is_exclusive", "tags",
            "sizes", "finishes", "frames", "created_at",
        )

    def get_vendor_id(self, obj):
        if obj.vendor_id:
            return obj.vendor_id
        if obj.artist and obj.artist.vendor_id:
            return obj.artist.vendor_id
        return None

    def get_sizes(self, obj):
        return PosterSizeSerializer(PosterSize.objects.all(), many=True).data

    def get_finishes(self, obj):
        return PosterFinishSerializer(PosterFinish.objects.all(), many=True).data

    def get_frames(self, obj):
        return PosterFrameSerializer(PosterFrame.objects.all(), many=True).data


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True)
    user_avatar = serializers.CharField(source="user.avatar", read_only=True)

    class Meta:
        model = Review
        fields = ("id", "user_name", "user_avatar", "rating", "text", "approved", "created_at")
        read_only_fields = ("id", "user_name", "user_avatar", "approved", "created_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )

    class Meta:
        model = WishlistItem
        fields = ("id", "product", "product_id", "added_at")
        read_only_fields = ("id", "added_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
