from django.conf import settings
from django.db import models


class LoyaltyTier(models.TextChoices):
    GENIN = "genin", "Genin"
    CHUNIN = "chunin", "Chunin"
    JONIN = "jonin", "Jonin"


class PointTransaction(models.Model):
    STATUS_PENDING = "pending"
    STATUS_AVAILABLE = "available"
    STATUS_SPENT = "spent"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_AVAILABLE, "Available"),
        (STATUS_SPENT, "Spent"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    TYPE_EARNED = "earned"
    TYPE_SPENT = "spent"
    TYPE_REFUNDED = "refunded"
    TYPE_REFUND_REVERSAL = "refund_reversal"
    TYPE_ADJUSTMENT = "adjustment"
    TYPE_CHOICES = [
        (TYPE_EARNED, "Earned"),
        (TYPE_SPENT, "Spent"),
        (TYPE_REFUNDED, "Refunded"),
        (TYPE_REFUND_REVERSAL, "Refund Reversal"),
        (TYPE_ADJUSTMENT, "Adjustment"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="point_transactions",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="point_transactions",
    )
    market_item = models.ForeignKey(
        "gamification.PointsMarketItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="point_transactions",
    )
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    points = models.IntegerField()
    description = models.CharField(max_length=255, blank=True)
    available_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "point_transactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=("user", "status", "created_at")),
            models.Index(fields=("order", "transaction_type")),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            old = type(self).objects.only("points", "transaction_type", "user_id").get(pk=self.pk)
            immutable_changed = (
                old.points != self.points
                or old.transaction_type != self.transaction_type
                or old.user_id != self.user_id
            )
            if immutable_changed:
                raise ValueError("PointTransaction ledger rows are append-only.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user_id}: {self.points} ({self.status})"


class PointsMarketItem(models.Model):
    TYPE_PHYSICAL = "physical"
    TYPE_DIGITAL = "digital"
    DISCOUNT_PERCENT = "percent"
    DISCOUNT_FIXED = "fixed"
    ITEM_TYPE_CHOICES = [
        (TYPE_PHYSICAL, "Physical Product"),
        (TYPE_DIGITAL, "Digital Voucher"),
    ]
    DISCOUNT_TYPE_CHOICES = [
        (DISCOUNT_PERCENT, "Percentage"),
        (DISCOUNT_FIXED, "Fixed Amount"),
    ]

    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    vendor = models.ForeignKey(
        "vendors.Vendor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="points_market_items",
    )
    main_image_url = models.URLField(blank=True)
    image_urls = models.JSONField(default=list, blank=True)
    point_cost = models.PositiveIntegerField()
    stock_quantity = models.PositiveIntegerField(default=0)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
    voucher_discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES, default=DISCOUNT_PERCENT)
    voucher_discount_value = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    voucher_min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "points_market_items"
        ordering = ["name"]
        indexes = [
            models.Index(fields=("is_active", "stock_quantity")),
            models.Index(fields=("item_type", "is_active")),
        ]

    @property
    def is_locked(self) -> bool:
        return not self.is_active or self.stock_quantity <= 0

    def __str__(self):
        return f"{self.name} ({self.point_cost} pts)"


class PointsMarketRedemption(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_SHIPPED = "shipped"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_SHIPPED, "Shipped"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="points_market_redemptions",
    )
    market_item = models.ForeignKey(
        "gamification.PointsMarketItem",
        on_delete=models.SET_NULL,
        null=True,
        related_name="redemptions",
    )
    transaction = models.OneToOneField(
        "gamification.PointTransaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="redemption",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    item_name = models.CharField(max_length=160)
    item_image_url = models.URLField(blank=True)
    point_cost = models.PositiveIntegerField()
    shipping_name = models.CharField(max_length=255)
    shipping_line1 = models.CharField(max_length=255)
    shipping_line2 = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=100)
    shipping_state = models.CharField(max_length=100)
    shipping_zip = models.CharField(max_length=20)
    shipping_country = models.CharField(max_length=100)
    shipping_email = models.EmailField()
    shipping_phone = models.CharField(max_length=30, blank=True)
    shipping_type = models.CharField(max_length=50)
    shipping_label = models.CharField(max_length=100)
    shipping_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    shipping_currency = models.CharField(max_length=10, default="USD")
    tracking_code = models.CharField(max_length=100, blank=True)
    admin_note = models.TextField(blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "points_market_redemptions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=("status", "created_at")),
            models.Index(fields=("user", "created_at")),
        ]

    def __str__(self):
        return f"{self.user_id}: {self.item_name} ({self.status})"


class PointsMarketShippingPaymentSession(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PAID, "Paid"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
    ]

    token = models.UUIDField(unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="points_market_shipping_sessions",
    )
    market_item = models.ForeignKey(
        "gamification.PointsMarketItem",
        on_delete=models.SET_NULL,
        null=True,
        related_name="shipping_payment_sessions",
    )
    redemption = models.OneToOneField(
        "gamification.PointsMarketRedemption",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipping_payment_session",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    item_name = models.CharField(max_length=160)
    item_image_url = models.URLField(blank=True)
    point_cost = models.PositiveIntegerField()
    shipping_name = models.CharField(max_length=255)
    shipping_line1 = models.CharField(max_length=255)
    shipping_line2 = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=100)
    shipping_state = models.CharField(max_length=100)
    shipping_zip = models.CharField(max_length=20)
    shipping_country = models.CharField(max_length=100)
    shipping_email = models.EmailField()
    shipping_phone = models.CharField(max_length=30, blank=True)
    shipping_type = models.CharField(max_length=50)
    shipping_label = models.CharField(max_length=100)
    shipping_price = models.DecimalField(max_digits=8, decimal_places=2)
    shipping_currency = models.CharField(max_length=10, default="USD")
    expires_at = models.DateTimeField()
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "points_market_shipping_payment_sessions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=("user", "status", "created_at")),
            models.Index(fields=("status", "expires_at")),
        ]

    def __str__(self):
        return f"{self.user_id}: {self.item_name} shipping ({self.status})"


class IdempotencyKey(models.Model):
    STATUS_PROCESSING = "processing"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PROCESSING, "Processing"),
        (STATUS_SUCCEEDED, "Succeeded"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="points_idempotency_keys",
    )
    key = models.UUIDField()
    scope = models.CharField(max_length=80)
    request_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PROCESSING)
    transaction = models.ForeignKey(
        "gamification.PointTransaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="idempotency_keys",
    )
    response_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "points_idempotency_keys"
        unique_together = [("user", "scope", "key")]
        indexes = [
            models.Index(fields=("user", "scope", "key")),
            models.Index(fields=("status", "created_at")),
        ]
