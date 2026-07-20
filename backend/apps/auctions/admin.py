from django.contrib import admin
from .models import Auction, AuctionBid, AuctionSubscriber


@admin.register(Auction)
class AuctionAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "starting_bid", "starts_at", "ends_at")
    list_filter = ("status",)
    search_fields = ("title",)


@admin.register(AuctionBid)
class AuctionBidAdmin(admin.ModelAdmin):
    list_display = ("auction", "user", "amount", "placed_at")
    ordering = ("-placed_at",)


@admin.register(AuctionSubscriber)
class AuctionSubscriberAdmin(admin.ModelAdmin):
    list_display = ("email", "user", "is_active", "subscribed_at")
    list_filter = ("is_active",)
    search_fields = ("email",)
    ordering = ("-subscribed_at",)
