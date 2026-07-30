"""Send sample transactional emails to verify SMTP + templates."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.emails.service import get_template, send_template_email


# Sample context per event — enough for {{placeholders}} to render.
_SAMPLE_CONTEXT = {
    "order_confirmed": {
        "customer_name": "Test Customer",
        "order_number": "TEST-1001",
        "total": "120.00",
        "currency": "USD",
        "items": "1× Sample Print",
        "items_html": "<p>1× Sample Print — $120.00</p>",
        "totals_html": "<p><strong>Total: $120.00</strong></p>",
        "shipping_address_html": "<p>123 Test St<br>Tbilisi, Georgia</p>",
    },
    "order_shipped": {
        "customer_name": "Test Customer",
        "order_number": "TEST-1001",
        "tracking_code": "TRACK123",
        "tracking_info": "Carrier: DHL — TRACK123",
        "total": "120.00",
        "items_html": "<p>1× Sample Print — $120.00</p>",
        "totals_html": "<p><strong>Total: $120.00</strong></p>",
        "shipping_address_html": "<p>123 Test St<br>Tbilisi, Georgia</p>",
    },
    "review_request": {
        "customer_name": "Test Customer",
        "order_number": "TEST-1001",
        "google_review_url": getattr(settings, "GOOGLE_REVIEW_URL", ""),
    },
    "custom_order_shipped": {
        "customer_name": "Test Customer",
        "tracking_code": "TRACK123",
        "payment_link": f"{settings.FRONTEND_URL}/",
        "product_image": "",
        "total": "250.00",
    },
    "auction_new": {
        "auction_title": "Sample Auction Lot",
        "starting_bid": "50.00",
        "starts_at": "July 23, 2026 at 12:00 UTC",
        "image_url": "",
        "auction_url": f"{settings.FRONTEND_URL}/auctions",
    },
    "auction_won": {
        "winner_name": "Test Customer",
        "auction_title": "Sample Auction Lot",
        "winning_amount": "175.00",
        "payment_link": f"{settings.FRONTEND_URL}/",
    },
    "password_reset": {
        "user_name": "Test Customer",
        "reset_url": f"{settings.FRONTEND_URL}/reset-password?token=test-token",
    },
}

# Events that are actually fired by app actions today.
_WIRED_EVENTS = (
    "password_reset",
    "order_confirmed",
    "order_shipped",
    "review_request",
    "custom_order_shipped",
    "auction_new",
    "auction_won",
)


class Command(BaseCommand):
    help = (
        "Send sample transactional emails to verify Google Workspace / SMTP. "
        "Use --all to include templates that exist but are not yet wired to actions."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "email",
            nargs="?",
            help="Recipient inbox (defaults to EMAIL_HOST_USER)",
        )
        parser.add_argument(
            "--event",
            action="append",
            dest="events",
            help="Event key to send (repeatable). Default: wired actions only.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Send every seeded template (including unwired ones).",
        )

    def handle(self, *args, **options):
        recipient = options["email"] or settings.EMAIL_HOST_USER
        if not recipient:
            raise CommandError(
                "Pass a recipient email, or set EMAIL_HOST_USER in backend/.env"
            )

        backend = settings.EMAIL_BACKEND
        host = settings.EMAIL_HOST
        user = settings.EMAIL_HOST_USER or "(empty)"
        self.stdout.write(f"Backend: {backend}")
        self.stdout.write(f"SMTP:    {host}:{settings.EMAIL_PORT} user={user}")
        self.stdout.write("From aliases:")
        self.stdout.write(f"  accounts = {settings.EMAIL_FROM_ACCOUNTS}")
        self.stdout.write(f"  orders   = {settings.EMAIL_FROM_ORDERS}")
        self.stdout.write(f"  auctions = {settings.EMAIL_FROM_AUCTIONS}")
        self.stdout.write(f"To:      {recipient}")
        self.stdout.write("")

        if "smtp" in backend and not settings.EMAIL_HOST_PASSWORD:
            raise CommandError(
                "EMAIL_HOST_PASSWORD is empty. Create a Google Workspace App Password "
                "and set it in backend/.env before sending real mail."
            )

        if options["events"]:
            events = options["events"]
        elif options["all"]:
            events = list(_SAMPLE_CONTEXT.keys())
        else:
            events = list(_WIRED_EVENTS)

        ok = 0
        failed = 0
        skipped = 0

        for event_key in events:
            if get_template(event_key) is None:
                self.stdout.write(self.style.WARNING(f"  SKIP  {event_key} (no active template)"))
                skipped += 1
                continue

            context = _SAMPLE_CONTEXT.get(event_key, {})
            success = send_template_email(event_key, recipient, context)
            if success:
                self.stdout.write(self.style.SUCCESS(f"  SENT  {event_key}"))
                ok += 1
            else:
                self.stdout.write(self.style.ERROR(f"  FAIL  {event_key}"))
                failed += 1

        self.stdout.write("")
        self.stdout.write(
            f"Done: sent={ok} failed={failed} skipped={skipped}"
        )
        if failed:
            raise CommandError("One or more emails failed — check EmailLog / SMTP credentials.")
