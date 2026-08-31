import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from apps.orders.keepz import get_keepz_order_status
from apps.orders.payment_service import reconcile_keepz_payments


class Command(BaseCommand):
    """Manual/always-on runner for the same job Celery Beat schedules.

    Kept alongside the Celery task so payments can still be recovered from a
    shell or a plain cron host when no worker is running.
    """

    help = "Reconcile stale Keepz payments when their webhook was delayed or missed."

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-age-seconds",
            type=int,
            default=120,
            help="Wait this long for the webhook before checking Keepz (default: 120).",
        )
        parser.add_argument(
            "--max-age-hours",
            type=int,
            default=24,
            help="Expire sessions older than this recovery window (default: 24).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=25,
            help="Maximum sessions checked in one run (default: 25).",
        )
        parser.add_argument(
            "--watch",
            action="store_true",
            help="Run continuously for an always-on task.",
        )
        parser.add_argument(
            "--interval-seconds",
            type=int,
            default=60,
            help="Delay between always-on checks (default: 60).",
        )

    def handle(self, *args, **options):
        min_age_seconds = options["min_age_seconds"]
        max_age_hours = options["max_age_hours"]
        limit = options["limit"]
        interval_seconds = options["interval_seconds"]
        if min_age_seconds < 60:
            raise CommandError("--min-age-seconds must be at least 60.")
        if max_age_hours < 1:
            raise CommandError("--max-age-hours must be at least 1.")
        if limit < 1 or limit > 100:
            raise CommandError("--limit must be between 1 and 100.")
        if interval_seconds < 30:
            raise CommandError("--interval-seconds must be at least 30.")

        if not options["watch"]:
            self._reconcile_once(min_age_seconds, max_age_hours, limit)
            return

        self.stdout.write(
            f"Watching stale payments every {interval_seconds} seconds; press Ctrl+C to stop."
        )
        try:
            while True:
                close_old_connections()
                self._reconcile_once(min_age_seconds, max_age_hours, limit)
                close_old_connections()
                time.sleep(interval_seconds)
        except KeyboardInterrupt:
            self.stdout.write("Payment reconciliation worker stopped.")

    def _reconcile_once(self, min_age_seconds, max_age_hours, limit):
        def report_error(payment, exc):
            self.stderr.write(self.style.ERROR(f"{payment.integrator_order_id}: {exc}"))

        report = reconcile_keepz_payments(
            status_fetcher=get_keepz_order_status,
            min_age_seconds=min_age_seconds,
            max_age_hours=max_age_hours,
            limit=limit,
            on_error=report_error,
        )
        self.stdout.write(report.as_line())
