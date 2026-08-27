from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.auctions.models import Auction, AuctionBid
from apps.orders.models import PaymentSession


class Command(BaseCommand):
    help = "Create an ended auction with a signed-in winner ready to test the payment flow."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="auction-winner@example.com")
        parser.add_argument("--password", default="AuctionWinner123!")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        user_model = get_user_model()
        winner, created = user_model.objects.get_or_create(
            email=email,
            defaults={"name": "Auction Payment QA"},
        )
        if created:
            winner.set_password(password)
            winner.save(update_fields=["password"])

        now = timezone.now()
        auction, _ = Auction.objects.update_or_create(
            slug="qa-auction-winner-payment",
            defaults={
                "title": "QA Winner Payment Auction",
                "artist_name": "Koleqcia QA",
                "starting_bid": Decimal("100.00"),
                "shipping_price_usd": Decimal("12.00"),
                "shipping_price_gel": Decimal("32.00"),
                "starts_at": now - timedelta(days=2),
                "ends_at": now - timedelta(minutes=5),
                "status": Auction.STATUS_ACTIVE,
                "winner": winner,
                "winning_amount": Decimal("125.00"),
                "winner_payment_status": Auction.PAYMENT_PENDING,
                "is_replacement_winner": False,
                "paid_at": None,
            },
        )
        AuctionBid.objects.filter(auction=auction, user=winner).delete()
        AuctionBid.objects.create(
            auction=auction,
            user=winner,
            amount=Decimal("125.00"),
            submitted_amount=Decimal("125.00"),
            submitted_currency="USD",
        )
        PaymentSession.objects.filter(
            purpose=PaymentSession.PURPOSE_AUCTION,
            user=winner,
            related_id=str(auction.pk),
            status__in=(PaymentSession.STATUS_CREATED, PaymentSession.STATUS_REDIRECTED),
        ).update(status=PaymentSession.STATUS_FAILED, last_error="Reset by QA auction payment seed.")

        self.stdout.write(self.style.SUCCESS("Auction winner payment seed is ready."))
        self.stdout.write(f"Auction: /en/auctions/{auction.slug}")
        self.stdout.write(f"Winner login: {email}")
        self.stdout.write(f"Password: {password if created else 'existing password unchanged'}")
