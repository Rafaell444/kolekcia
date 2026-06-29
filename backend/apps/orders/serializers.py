from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem, OrderStatusHistory, CustomOrder
from apps.products.serializers import ProductVariantSerializer


class CartItemSerializer(serializers.ModelSerializer):
    variant = ProductVariantSerializer(read_only=True)
    variant_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__("apps.products.models", fromlist=["ProductVariant"]).ProductVariant.objects.all(),
        source="variant",
        write_only=True,
    )
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    product_title = serializers.CharField(source="variant.product.title", read_only=True)
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ("id", "variant", "variant_id", "quantity", "line_total", "product_title", "product_image")

    def get_product_image(self, obj):
        img = obj.variant.product.images.first()
        return img.url if img else ""


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    promo_code_str = serializers.CharField(source="promo_code.code", read_only=True, allow_null=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "subtotal", "promo_code_str")


class AddToCartSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "product_title", "product_image", "artist_name", "size_label", "finish_label", "frame_label", "price", "quantity", "line_total")


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
            "subtotal", "discount", "total", "promo_code_str",
            "tracking_code", "created_at",
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


class CustomOrderSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)

    class Meta:
        model = CustomOrder
        fields = (
            "id", "vendor", "vendor_name", "product_type",
            "name", "email", "phone", "image_url", "notes",
            "status", "payment_ref", "created_at",
        )
        read_only_fields = ("id", "vendor_name", "status", "payment_ref", "created_at")
        extra_kwargs = {"vendor": {"write_only": False, "required": False, "allow_null": True}}
