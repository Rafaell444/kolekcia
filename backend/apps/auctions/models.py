from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from apps.users.models import User
from apps.products.models import Product


class Auction(models.Model):
    STATUS_INACTIVE = "inactive"
    STATUS_ACTIVE = "active"
    STATUS_BOUGHT = "bought"
    STATUS_CHOICES = [
        (STATUS_INACTIVE, "Inactive"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_BOUGHT, "Bought"),
    ]

    PAYMENT_PENDING = "pending"
    PAYMENT_PAID = "paid"
    PAYMENT_FAILED = "failed"
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_PENDING, "Pending"),
        (PAYMENT_PAID, "Paid"),
        (PAYMENT_FAILED, "Failed"),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="auctions", null=True, blank=True)
    vendor = models.ForeignKey("vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="auctions")
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    title = models.CharField(max_length=255)
    artist_name = models.CharField(max_length=255, blank=True)
    image_url = models.URLField(blank=True)
    starting_bid = models.DecimalField(max_digits=10, decimal_places=2)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    is_live = models.BooleanField(default=False)
    winner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="won_auctions")
    winning_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    winner_payment_status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS_CHOICES, blank=True, default=""
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auctions"
        ordering = ["ends_at"]

    @property
    def current_bid(self):
        latest = self.bids.order_by("-amount").first()
        return latest.amount if latest else self.starting_bid

    @property
    def bid_count(self):
        return self.bids.count()

    @property
    def top_bidder(self):
        latest = self.bids.order_by("-amount").first()
        return latest.user.name or latest.user.email if latest else "—"

    def is_upcoming(self):
        return self.starts_at > timezone.now()

    def is_biddable(self):
        now = timezone.now()
        return (
            self.status == self.STATUS_ACTIVE
            and self.starts_at <= now < self.ends_at
        )

    def is_ended(self):
        return self.ends_at <= timezone.now()

    def refresh_live_flag(self):
        self.is_live = self.is_biddable()

    def finalize_if_ended(self):
        if not self.is_ended() or self.status != self.STATUS_ACTIVE:
            return False
        top_bid = self.bids.order_by("-amount").first()
        if top_bid:
            self.winner = top_bid.user
            self.winning_amount = top_bid.amount
            if not self.winner_payment_status:
                self.winner_payment_status = self.PAYMENT_PENDING
        self.refresh_live_flag()
        self.save(update_fields=["winner", "winning_amount", "winner_payment_status", "is_live"])
        return True

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or "auction"
            candidate = base
            n = 1
            while Auction.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{n}"
                n += 1
            self.slug = candidate
        self.refresh_live_flag()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class AuctionBid(models.Model):
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="bids")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bids")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    placed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auction_bids"
        ordering = ["-placed_at"]

    def __str__(self):
        return f"{self.user.email} → {self.auction.title}: ${self.amount}"


class AuctionChatMessage(models.Model):
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="chat_messages")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="auction_chat_messages")
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auction_chat_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user.email} @ {self.auction.title}"
