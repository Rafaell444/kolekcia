from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Send one Google review request 20 days after each order ships."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=20, help="Days after shipment before sending (default: 20).")
        parser.add_argument("--dry-run", action="store_true", help="Show eligible orders without sending email.")

    def handle(self, *args, **options):
        from apps.emails.service import send_template_email
        from apps.orders.models import Order

        review_url = getattr(settings, "GOOGLE_REVIEW_URL", "").strip()
        if not review_url:
            self.stderr.write("GOOGLE_REVIEW_URL is not configured; no review emails sent.")
            return

        days = options["days"]
        if days < 0:
            self.stderr.write("--days must be zero or greater.")
            return

        # Orders shipped before shipped_at was introduced can recover their
        # timestamp from the existing status history.
        legacy = Order.objects.filter(
            status__in=("shipped", "delivered"), shipped_at__isnull=True
        ).prefetch_related("status_history")
        backfilled = 0
        for order in legacy.iterator():
            shipped_event = order.status_history.filter(status="shipped").order_by("changed_at").first()
            if shipped_event:
                Order.objects.filter(pk=order.pk, shipped_at__isnull=True).update(shipped_at=shipped_event.changed_at)
                backfilled += 1

        cutoff = timezone.now() - timedelta(days=days)
        orders = Order.objects.filter(
            status__in=("shipped", "delivered"),
            shipped_at__lte=cutoff,
            review_requested_at__isnull=True,
        ).only("id", "order_number", "shipping_email", "shipping_name")

        eligible = orders.count()
        self.stdout.write(f"Shipment timestamps backfilled: {backfilled}")
        self.stdout.write(f"Eligible orders ({days}+ days after shipping): {eligible}")
        if options["dry_run"]:
            for order in orders.order_by("shipped_at").values_list("order_number", "shipping_email", "shipped_at"):
                self.stdout.write(f"  {order[0]} | {order[1]} | shipped {order[2]}")
            return

        sent = 0
        for order in orders.iterator():
            customer_name = order.shipping_name.split(" ")[0] if order.shipping_name else "there"
            ok = send_template_email(
                "review_request",
                order.shipping_email,
                {
                    "customer_name": customer_name,
                    "order_number": order.order_number,
                    "google_review_url": review_url,
                },
            )
            if ok:
                Order.objects.filter(pk=order.pk, review_requested_at__isnull=True).update(
                    review_requested_at=timezone.now()
                )
                sent += 1

        self.stdout.write(self.style.SUCCESS(f"Review requests sent: {sent}"))
