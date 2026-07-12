import uuid
from django.db import models
from apps.users.models import User
from apps.products.models import Product, ProductVariant, SizeVariant


class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="cart")
    promo_code = models.ForeignKey("promo.PromoCode", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "carts"

    @property
    def subtotal(self):
        return sum(item.line_total for item in self.items.all())

    def __str__(self):
        return f"Cart({self.user.email})"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.CASCADE)
    size_variant = models.ForeignKey(SizeVariant, null=True, blank=True, on_delete=models.SET_NULL, related_name="cart_items")
    quantity = models.PositiveIntegerField(default=1)
    gift_wrap = models.BooleanField(default=False)
    gift_wrap_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    gift_wrap_note = models.CharField(max_length=500, blank=True, default="")
    gift_wrap_image_url = models.URLField(blank=True, default="")
    delivery_type = models.CharField(max_length=20, default="standard")
    processing_option = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "cart_items"

    @property
    def line_total(self):
        from decimal import Decimal
        if self.size_variant_id:
            base = Decimal(self.size_variant.price_usd) * self.quantity
        elif self.variant_id:
            base = self.variant.price * self.quantity
        else:
            base = Decimal("0")
        wrap = Decimal(self.gift_wrap_price) if self.gift_wrap else Decimal("0")
        return base + wrap

    def __str__(self):
        label = self.size_variant.label if self.size_variant_id else str(self.variant)
        return f"{self.cart} × {label}"


class Order(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=30, unique=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="orders")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    promo_code = models.ForeignKey("promo.PromoCode", null=True, blank=True, on_delete=models.SET_NULL)

    shipping_name = models.CharField(max_length=255)
    shipping_line1 = models.CharField(max_length=255)
    shipping_line2 = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=100)
    shipping_state = models.CharField(max_length=100)
    shipping_zip = models.CharField(max_length=20)
    shipping_country = models.CharField(max_length=100)
    shipping_email = models.EmailField()
    shipping_phone = models.CharField(max_length=30, blank=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_type = models.CharField(max_length=20, default="standard")
    delivery_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    gift_wrap_total = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="USD")
    total = models.DecimalField(max_digits=10, decimal_places=2)
    tracking_code = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "orders"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.order_number:
            import random
            self.order_number = f"KOL-{self.created_at.year if hasattr(self, 'created_at') and self.created_at else '2024'}-{random.randint(100000, 999999)}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number


class DeliveryOption(models.Model):
    slug = models.CharField(max_length=20, unique=True)
    label = models.CharField(max_length=50)
    price_gel = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    price_usd = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    est_days_min = models.PositiveIntegerField(default=1)
    est_days_max = models.PositiveIntegerField(default=5)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "delivery_options"
        ordering = ["sort_order"]

    def __str__(self):
        return self.label


class VendorShippingOption(models.Model):
    MARKET_CHOICES = [
        ("GE", "Georgian"),
        ("OTHER", "Other"),
    ]

    vendor = models.ForeignKey("vendors.Vendor", on_delete=models.CASCADE, related_name="shipping_options")
    market = models.CharField(max_length=10, choices=MARKET_CHOICES)
    label = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    est_days_min = models.PositiveIntegerField(default=1)
    est_days_max = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "vendor_shipping_options"
        ordering = ["market", "sort_order"]
        unique_together = [("vendor", "market", "label")]

    def __str__(self):
        return f"{self.vendor.name} — {self.market} {self.label}"


class ProcessingOption(models.Model):
    vendor = models.ForeignKey(
        "vendors.Vendor",
        on_delete=models.CASCADE,
        related_name="processing_options",
        null=True,
        blank=True,
    )
    slug = models.SlugField()
    label = models.CharField(max_length=100)
    est_days_min = models.PositiveSmallIntegerField(default=1)
    est_days_max = models.PositiveSmallIntegerField(default=5)
    price_usd = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    price_gel = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "processing_options"
        ordering = ["sort_order"]
        unique_together = [("vendor", "slug")]

    def __str__(self):
        return self.label


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    vendor = models.ForeignKey("vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items")
    product_title = models.CharField(max_length=255)
    product_image = models.URLField(blank=True)
    artist_name = models.CharField(max_length=255, blank=True)
    size_label = models.CharField(max_length=50)
    finish_label = models.CharField(max_length=50)
    frame_label = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    gift_wrap = models.BooleanField(default=False)
    gift_wrap_note = models.CharField(max_length=500, blank=True, default="")
    gift_wrap_image_url = models.URLField(blank=True, default="")
    processing_option = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "order_items"

    @property
    def line_total(self):
        return self.price * self.quantity


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_history")
    status = models.CharField(max_length=20)
    note = models.TextField(blank=True)
    changed_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "order_status_history"
        ordering = ["changed_at"]


class CustomOrder(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("review", "In Review"),
        ("approved", "Approved"),
        ("paid", "Paid"),
        ("printing", "Printing"),
        ("shipped", "Shipped"),
        ("cancelled", "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="custom_orders")
    vendor = models.ForeignKey("vendors.Vendor", null=True, blank=True, on_delete=models.SET_NULL, related_name="custom_orders")
    product_type = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    image_url = models.TextField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    payment_ref = models.CharField(max_length=100, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default="USD")
    payment_url = models.URLField(blank=True)
    tracking_code = models.CharField(max_length=100, blank=True)
    cancel_reason = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "custom_orders"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.payment_ref:
            import random, string
            self.payment_ref = "KOL-CUSTOM-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        super().save(*args, **kwargs)
