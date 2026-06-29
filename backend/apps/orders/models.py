import uuid
from django.db import models
from apps.users.models import User
from apps.products.models import Product, ProductVariant


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
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "cart_items"
        unique_together = ("cart", "variant")

    @property
    def line_total(self):
        return self.variant.price * self.quantity

    def __str__(self):
        return f"{self.cart} × {self.variant}"


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
    image_url = models.URLField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    payment_ref = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "custom_orders"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.payment_ref:
            import random, string
            self.payment_ref = "KOL-CUSTOM-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        super().save(*args, **kwargs)
