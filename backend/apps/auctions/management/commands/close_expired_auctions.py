from django.core.management.base import BaseCommand
from apps.auctions.models import Auction


class Command(BaseCommand):
    help = "Finalize ended auctions by assigning winners and payment status."

    def handle(self, *args, **options):
        auctions = Auction.objects.filter(status=Auction.STATUS_ACTIVE)
        finalized = 0
        for auction in auctions:
            if auction.finalize_if_ended():
                finalized += 1
                self.stdout.write(f"  Finalized: {auction.title} → winner {auction.winner_id}")
        self.stdout.write(self.style.SUCCESS(f"Done. Finalized {finalized} auction(s)."))
