from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem, OrderShipment, OrderStatusHistory, CustomOrder, DeliveryOption, ProcessingOption, VendorShippingOption
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
            "id", "variant", "size_variant", "quantity", "unit_price", "currency", "line_total",
            "product_title", "product_image", "size_label",
            "gift_wrap", "gift_wrap_price", "gift_wrap_note", "gift_wrap_image_url",
            "delivery_type", "processing_option", "processing_fee", "processing_label", "processing_days",
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
        fields = ("id", "vendor", "vendor_slug", "slug", "label", "label_ka", "label_ru", "est_days_min", "est_days_max", "price_usd", "price_gel", "is_included", "sort_order", "is_active")


class VendorShippingOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorShippingOption
        fields = ("id", "market", "label", "price", "est_days_min", "est_days_max", "is_active", "is_express", "sort_order")


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    promo_code_str = serializers.CharField(source="promo_code.code", read_only=True, allow_null=True)
    discount = serializers.SerializerMethodField()
    promo_percent = serializers.SerializerMethodField()
    promo_products_only = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = (
            "id", "items", "subtotal", "promo_code_str",
            "discount", "promo_percent", "promo_products_only",
        )

    def get_discount(self, obj):
        from decimal import Decimal
        from apps.creators.services import product_subtotal_from_cart

        promo = obj.promo_code
        if not promo:
            return "0.00"
        if promo.owner_id:
            amount = promo.calculate_product_discount(product_subtotal_from_cart(obj))
        elif promo.is_scoped:
            items_with_products = []
            for item in obj.items.select_related(
                "variant__product", "size_variant__product"
            ):
                product = (
                    item.size_variant.product if item.size_variant_id
                    else item.variant.product if item.variant_id
                    else None
                )
                if product:
                    unit = Decimal(item.unit_price or 0)
                    if unit == 0:
                        from apps.orders.pricing import resolve_unit_price
                        unit = resolve_unit_price(item.variant, item.size_variant, item.currency)
                    items_with_products.append((product, unit * item.quantity))
            amount = promo.calculate_scoped_discount(items_with_products)
        else:
            amount = promo.calculate_discount(Decimal(obj.subtotal))
        return str(amount.quantize(Decimal("0.01")))

    def get_promo_percent(self, obj):
        promo = obj.promo_code
        if not promo or promo.discount_type != "percent":
            return None
        return str(promo.discount_value)

    def get_promo_products_only(self, obj):
        promo = obj.promo_code
        return bool(promo and (promo.owner_id or promo.is_scoped))


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


class OrderShipmentSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True, default="")

    class Meta:
        model = OrderShipment
        fields = (
            "id", "vendor", "vendor_name", "delivery_type", "delivery_label",
            "delivery_price", "tracking_code", "shipped_at", "status", "created_at",
        )
        read_only_fields = ("id", "created_at")


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    vendor_id = serializers.IntegerField(source="vendor.id", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True, default="")
    shipment_id = serializers.IntegerField(source="shipment.id", read_only=True, allow_null=True)

    class Meta:
        model = OrderItem
        fields = ("id", "product_title", "product_image", "artist_name", "size_label", "finish_label", "frame_label", "price", "quantity", "line_total", "gift_wrap", "gift_wrap_note", "gift_wrap_image_url", "processing_option", "processing_fee", "processing_label", "processing_days", "vendor_id", "vendor_name", "shipment_id")


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.CharField(source="changed_by.email", read_only=True, allow_null=True)

    class Meta:
        model = OrderStatusHistory
        fields = ("id", "status", "note", "changed_by_email", "changed_at")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    shipments = OrderShipmentSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    promo_code_str = serializers.CharField(source="promo_code.code", read_only=True, allow_null=True)

    class Meta:
        model = Order
        fields = (
            "id", "order_number", "status", "items", "shipments", "status_history",
            "shipping_name", "shipping_line1", "shipping_line2",
            "shipping_city", "shipping_state", "shipping_zip", "shipping_country",
            "shipping_email", "shipping_phone",
            "subtotal", "discount", "delivery_type", "delivery_price", "gift_wrap_total", "processing_fee_total", "currency", "total",
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
    delivery_type = serializers.CharField(max_length=50, required=False, default="standard")
    # Per-vendor shipping: { "vendor_id": "vendor-{option_id}", ... }
    shipping_selections = serializers.DictField(
        child=serializers.CharField(), required=False, allow_empty=True, default=dict,
    )


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
