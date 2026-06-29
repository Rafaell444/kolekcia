from django.db import models
from apps.users.models import User
from apps.products.models import Product


class Auction(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="auctions", null=True, blank=True)
    title = models.CharField(max_length=255)
    artist_name = models.CharField(max_length=255, blank=True)
    image_url = models.URLField(blank=True)
    starting_bid = models.DecimalField(max_digits=10, decimal_places=2)
    ends_at = models.DateTimeField()
    is_live = models.BooleanField(default=False)
    winner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="won_auctions")
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
