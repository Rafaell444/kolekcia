from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum, Q
from django.utils import timezone


class CreatorApplication(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="creator_applications",
    )
    phone = models.CharField(max_length=40)
    email = models.EmailField()
    tiktok = models.CharField(max_length=255, blank=True, default="")
    facebook = models.CharField(max_length=255, blank=True, default="")
    instagram = models.CharField(max_length=255, blank=True, default="")
    youtube = models.CharField(max_length=255, blank=True, default="")
    # ISO 3166-1 alpha-2 country code, e.g. "GE", "US"
    country = models.CharField(max_length=5, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    admin_note = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_creator_applications",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "creator_applications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"CreatorApplication({self.user_id}, {self.status})"


class ContentCreator(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="content_creator",
    )
    is_active = models.BooleanField(default=True)
    promo = models.OneToOneField(
        "promo.PromoCode",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="content_creator",
    )
    # ISO 3166-1 alpha-2: "GE" = Georgian creator (always paid in GEL, NBG conversion applied).
    # Any other value = international creator (paid in order currency).
    country = models.CharField(max_length=5, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "content_creators"

    def __str__(self):
        return f"ContentCreator({self.user.email})"

    @property
    def available_balance(self) -> Decimal:
        """Credits minus holds/payouts/clawbacks."""
        agg = self.ledger_entries.aggregate(
            credits=Sum("amount", filter=Q(entry_type=CreatorLedgerEntry.TYPE_CREDIT)),
            outs=Sum(
                "amount",
                filter=Q(
                    entry_type__in=[
                        CreatorLedgerEntry.TYPE_PAYOUT_HOLD,
                        CreatorLedgerEntry.TYPE_PAYOUT_PAID,
                        CreatorLedgerEntry.TYPE_CLAWBACK,
                    ]
                ),
            ),
        )
        credits = agg["credits"] or Decimal("0")
        outs = agg["outs"] or Decimal("0")
        return (credits - outs).quantize(Decimal("0.01"))

    @property
    def lifetime_earned(self) -> Decimal:
        agg = self.ledger_entries.filter(entry_type=CreatorLedgerEntry.TYPE_CREDIT).aggregate(
            total=Sum("amount")
        )
        return (agg["total"] or Decimal("0")).quantize(Decimal("0.01"))

    @property
    def pending_payout(self) -> Decimal:
        agg = self.ledger_entries.filter(entry_type=CreatorLedgerEntry.TYPE_PAYOUT_HOLD).aggregate(
            total=Sum("amount")
        )
        return (agg["total"] or Decimal("0")).quantize(Decimal("0.01"))


class FxRate(models.Model):
    """
    Cached daily exchange rates fetched from the National Bank of Georgia (NBG) API.
    Used to convert foreign-currency creator earnings to GEL for Georgian creators.
    """
    date = models.DateField()
    from_currency = models.CharField(max_length=10)   # e.g. "USD", "EUR"
    to_currency = models.CharField(max_length=10)     # always "GEL" for now
    rate = models.DecimalField(max_digits=14, decimal_places=6)
    source = models.CharField(max_length=50, default="NBG")
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "creator_fx_rates"
        unique_together = [("date", "from_currency", "to_currency")]
        ordering = ["-date"]

    def __str__(self):
        return f"{self.from_currency}/{self.to_currency} {self.date} = {self.rate}"


class CreatorLedgerEntry(models.Model):
    TYPE_CREDIT = "credit"
    TYPE_CLAWBACK = "clawback"
    TYPE_PAYOUT_HOLD = "payout_hold"
    TYPE_PAYOUT_PAID = "payout_paid"
    TYPE_CHOICES = [
        (TYPE_CREDIT, "Order credit"),
        (TYPE_CLAWBACK, "Clawback"),
        (TYPE_PAYOUT_HOLD, "Payout hold"),
        (TYPE_PAYOUT_PAID, "Payout paid"),
    ]

    creator = models.ForeignKey(
        ContentCreator, on_delete=models.CASCADE, related_name="ledger_entries"
    )
    entry_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="GEL")
    order = models.ForeignKey(
        "orders.Order",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="creator_ledger_entries",
    )
    payout_request = models.ForeignKey(
        "CreatorPayoutRequest",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    # Snapshot for audit
    order_number = models.CharField(max_length=40, blank=True, default="")
    buyer_email = models.EmailField(blank=True, default="")
    product_subtotal = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discount_percent = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    note = models.TextField(blank=True, default="")
    # FX conversion audit — populated when creator.country=="GE" and order.currency!="GEL"
    original_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    original_currency = models.CharField(max_length=10, blank=True, default="")
    fx_rate = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True)
    fx_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "creator_ledger_entries"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.entry_type} {self.amount} ({self.creator_id})"


class CreatorPayoutRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PAID, "Paid"),
        (STATUS_REJECTED, "Rejected"),
    ]

    creator = models.ForeignKey(
        ContentCreator, on_delete=models.CASCADE, related_name="payout_requests"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="GEL")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    admin_note = models.TextField(blank=True, default="")
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="processed_creator_payouts",
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "creator_payout_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payout({self.creator_id}, {self.amount}, {self.status})"
