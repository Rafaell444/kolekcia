from rest_framework import serializers
from .models import Category, Artist, Product, ProductImage, ProductVariant, SizeVariant, PosterSize, PosterFinish, PosterFrame, Review, WishlistItem
from apps.vendors.models import Vendor


class CategorySerializer(serializers.ModelSerializer):
    count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "image_url", "count")

    def get_count(self, obj):
        from django.db.models import Q
        return (
            Product.objects.filter(status="active")
            .filter(Q(category=obj) | Q(categories=obj))
            .distinct()
            .count()
        )


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


class SizeVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = SizeVariant
        fields = (
            "id", "label", "price_usd", "price_gel", "price_eur", "price_gbp",
            "sale_price_usd", "sale_price_gel",
            "sort_order", "is_active",
        )


class ProductImageSerializer(serializers.ModelSerializer):
    src = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ("id", "url", "src", "media_type", "order")

    def get_src(self, obj):
        if obj.video_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.video_file.url)
            return obj.video_file.url
        return obj.url


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
    artist_name = serializers.CharField(source="artist.name", read_only=True, allow_null=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True, allow_null=True)
    category_slugs = serializers.SerializerMethodField()
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)
    image_url = serializers.SerializerMethodField()
    default_variant_id = serializers.SerializerMethodField()
    default_size_variant_id = serializers.SerializerMethodField()
    size_variants = SizeVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            "id", "slug", "title", "artist_name", "category_slug", "category_slugs", "image_url",
            "vendor_slug", "vendor_name",
            "base_price", "original_price", "regional_prices", "rating", "review_count",
            "is_limited", "is_sale", "is_new", "is_exclusive", "allow_custom_size", "status", "tags",
            "description", "material",
            "default_variant_id", "default_size_variant_id", "size_variants",
        )

    def get_image_url(self, obj):
        # Prefer an actual image; fall back to any media. Uploaded files live in
        # video_file (url is blank), so resolve that when present.
        images = list(obj.images.all())
        first = next((i for i in images if i.media_type == "image"), None) or (images[0] if images else None)
        if not first:
            return ""
        if first.url:
            return first.url
        if first.video_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(first.video_file.url)
            return first.video_file.url
        return ""

    def get_default_variant_id(self, obj):
        size_variants = [sv for sv in obj.size_variants.all() if sv.is_active]
        if size_variants:
            return None
        first = obj.variants.first()
        return first.id if first else None

    def get_default_size_variant_id(self, obj):
        first = obj.size_variants.filter(is_active=True).order_by("sort_order", "id").first()
        return first.id if first else None

    def get_category_slugs(self, obj):
        return list(obj.categories.values_list("slug", flat=True))


class ProductDetailSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(read_only=True)
    artist = ArtistSerializer(read_only=True, allow_null=True)
    artist_name = serializers.CharField(source="artist.name", read_only=True, allow_null=True)
    category = CategorySerializer(read_only=True, allow_null=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True, allow_null=True)
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    categories_data = serializers.SerializerMethodField()
    category_slugs = serializers.SerializerMethodField()
    vendor_id = serializers.SerializerMethodField()
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)
    category_slug_input = serializers.CharField(write_only=True, required=False, allow_blank=True)
    categories_input = serializers.CharField(write_only=True, required=False, allow_blank=True)
    artist_handle = serializers.CharField(write_only=True, required=False, allow_blank=True)
    image_url = serializers.URLField(write_only=True, required=False, allow_blank=True)
    vendor_slug_input = serializers.CharField(write_only=True, required=False, allow_blank=True)
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    size_variants = SizeVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            "id", "slug", "title", "artist", "artist_name",
            "category", "category_slug", "category_name", "categories_data", "category_slugs",
            "vendor_id", "vendor_slug", "vendor_name", "images", "variants", "size_variants",
            "base_price", "original_price", "regional_prices", "rating", "review_count",
            "is_limited", "is_sale", "is_new", "is_exclusive", "allow_custom_size", "status", "tags",
            "description", "material", "created_at",
            "category_slug_input", "categories_input", "artist_handle", "image_url", "vendor_slug_input",
        )

    def get_vendor_id(self, obj):
        if obj.vendor_id:
            return obj.vendor_id
        if obj.artist and obj.artist.vendor_id:
            return obj.artist.vendor_id
        return None

    def get_categories_data(self, obj):
        return CategorySerializer(obj.categories.all(), many=True).data

    def get_category_slugs(self, obj):
        return list(obj.categories.values_list("slug", flat=True))

    def _resolve_vendor(self, validated_data):
        request = self.context.get("request")
        if request and not request.user.is_staff and hasattr(request.user, "vendor_profile"):
            return request.user.vendor_profile
        v_slug = validated_data.pop("vendor_slug_input", "").strip()
        if not v_slug:
            return None
        return Vendor.objects.filter(slug=v_slug).first()

    def _resolve_category(self, validated_data):
        slug = validated_data.pop("category_slug_input", "").strip()
        if not slug:
            return None
        return Category.objects.filter(slug=slug).first()

    def _resolve_categories(self, validated_data):
        raw = validated_data.pop("categories_input", "").strip()
        if not raw:
            return []
        slugs = [s.strip() for s in raw.split(",") if s.strip()]
        return list(Category.objects.filter(slug__in=slugs))

    def _resolve_artist(self, validated_data):
        handle = validated_data.pop("artist_handle", "").strip()
        if not handle:
            return None
        return Artist.objects.filter(handle=handle).first()

    def create(self, validated_data):
        image_url = validated_data.pop("image_url", "").strip()
        category = self._resolve_category(validated_data)
        categories = self._resolve_categories(validated_data)
        artist = self._resolve_artist(validated_data)
        vendor = self._resolve_vendor(validated_data)
        tags = validated_data.get("tags")
        if isinstance(tags, str):
            validated_data["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
        product = Product.objects.create(
            category=category or (categories[0] if categories else None),
            artist=artist,
            vendor=vendor,
            **validated_data,
        )
        if categories:
            product.categories.set(categories)
        elif category:
            product.categories.add(category)
        if image_url:
            ProductImage.objects.create(product=product, url=image_url, order=0)
        return product

    def update(self, instance, validated_data):
        image_url = validated_data.pop("image_url", None)
        if "category_slug_input" in validated_data:
            instance.category = self._resolve_category(validated_data)
        if "categories_input" in validated_data:
            categories = self._resolve_categories(validated_data)
            if categories:
                instance.categories.set(categories)
                instance.category = categories[0]
            else:
                instance.categories.clear()
                instance.category = None
        if "artist_handle" in validated_data:
            instance.artist = self._resolve_artist(validated_data)
        if "vendor_slug_input" in validated_data:
            instance.vendor = self._resolve_vendor(validated_data)
        tags = validated_data.get("tags")
        if isinstance(tags, str):
            validated_data["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if isinstance(image_url, str):
            image_url = image_url.strip()
            ProductImage.objects.filter(product=instance).delete()
            if image_url:
                ProductImage.objects.create(product=instance, url=image_url, order=0)
        return instance


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
