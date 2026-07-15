from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem, OrderStatusHistory, CustomOrder, DeliveryOption, ProcessingOption, VendorShippingOption
from apps.products.serializers import ProductVariantSerializer, SizeVariantSerializer
from apps.vendors.models import Vendor


class CartItemSerializer(serializers.ModelSerializer):
    variant = ProductVariantSerializer(read_only=True, allow_null=True)
    size_variant = SizeVariantSerializer(read_only=True, allow_null=True)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    product_title = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    size_label = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = (
            "id", "variant", "size_variant", "quantity", "line_total",
            "product_title", "product_image", "size_label",
            "gift_wrap", "gift_wrap_price", "gift_wrap_note", "gift_wrap_image_url",
            "delivery_type", "processing_option",
        )

    def get_product_title(self, obj):
        if obj.size_variant_id:
            return obj.size_variant.product.title
        if obj.variant_id:
            return obj.variant.product.title
        return ""

    def get_product_image(self, obj):
        product = None
        if obj.size_variant_id:
            product = obj.size_variant.product
        elif obj.variant_id:
            product = obj.variant.product
        if product:
            img = product.images.first()
            if not img:
                return ""
            if img.url:
                return img.url
            if img.video_file:
                request = self.context.get("request")
                if request:
                    return request.build_absolute_uri(img.video_file.url)
                return img.video_file.url
        return ""

    def get_size_label(self, obj):
        if obj.size_variant_id:
            return obj.size_variant.label
        if obj.variant_id:
            return obj.variant.size.label if obj.variant.size_id else ""
        return ""


class DeliveryOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryOption
        fields = ("id", "slug", "label", "price_gel", "price_usd", "est_days_min", "est_days_max", "sort_order", "is_active")


class ProcessingOptionSerializer(serializers.ModelSerializer):
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True, allow_null=True)
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.all(), required=False, allow_null=True
    )
    slug = serializers.SlugField(required=False, allow_blank=True, default="")

    class Meta:
        model = ProcessingOption
        fields = ("id", "vendor", "vendor_slug", "slug", "label", "est_days_min", "est_days_max", "price_usd", "price_gel", "sort_order", "is_active")


class VendorShippingOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorShippingOption
        fields = ("id", "market", "label", "price", "est_days_min", "est_days_max", "is_active", "sort_order")


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    promo_code_str = serializers.CharField(source="promo_code.code", read_only=True, allow_null=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "subtotal", "promo_code_str")


class AddToCartSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    size_variant_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, default=1)
    gift_wrap = serializers.BooleanField(default=False, required=False)
    gift_wrap_note = serializers.CharField(max_length=500, default="", required=False, allow_blank=True)
    gift_wrap_image_url = serializers.CharField(max_length=500, default="", required=False, allow_blank=True)
    delivery_type = serializers.CharField(max_length=20, default="standard", required=False)
    processing_option = serializers.CharField(max_length=50, default="", required=False, allow_blank=True)
    currency = serializers.CharField(max_length=3, default="USD", required=False)

    def validate(self, attrs):
        if not attrs.get("variant_id") and not attrs.get("size_variant_id"):
            raise serializers.ValidationError("Either variant_id or size_variant_id is required.")
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "product_title", "product_image", "artist_name", "size_label", "finish_label", "frame_label", "price", "quantity", "line_total", "gift_wrap", "gift_wrap_note", "gift_wrap_image_url", "processing_option")


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.CharField(source="changed_by.email", read_only=True, allow_null=True)

    class Meta:
        model = OrderStatusHistory
        fields = ("id", "status", "note", "changed_by_email", "changed_at")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    promo_code_str = serializers.CharField(source="promo_code.code", read_only=True, allow_null=True)

    class Meta:
        model = Order
        fields = (
            "id", "order_number", "status", "items", "status_history",
            "shipping_name", "shipping_line1", "shipping_line2",
            "shipping_city", "shipping_state", "shipping_zip", "shipping_country",
            "shipping_email", "shipping_phone",
            "subtotal", "discount", "delivery_type", "delivery_price", "gift_wrap_total", "currency", "total",
            "promo_code_str", "tracking_code", "created_at",
        )
        read_only_fields = ("id", "order_number", "status", "subtotal", "discount", "total", "created_at")


class CheckoutSerializer(serializers.Serializer):
    shipping_name = serializers.CharField(max_length=255)
    shipping_line1 = serializers.CharField(max_length=255)
    shipping_line2 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    shipping_city = serializers.CharField(max_length=100)
    shipping_state = serializers.CharField(max_length=100)
    shipping_zip = serializers.CharField(max_length=20)
    shipping_country = serializers.CharField(max_length=100)
    shipping_email = serializers.EmailField()
    shipping_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    promo_code = serializers.CharField(required=False, allow_blank=True)
    currency = serializers.CharField(max_length=10, required=False, default="USD")
    delivery_type = serializers.CharField(max_length=20, required=False, default="standard")


class CustomOrderSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)

    class Meta:
        model = CustomOrder
        fields = (
            "id", "vendor", "vendor_name", "product_type",
            "name", "email", "phone", "image_url", "notes",
            "status", "payment_ref", "price", "currency", "payment_url",
            "tracking_code", "cancel_reason", "paid_at", "created_at",
        )
        read_only_fields = (
            "id", "vendor_name", "payment_ref", "paid_at", "created_at",
        )
        extra_kwargs = {"vendor": {"write_only": False, "required": False, "allow_null": True}}
