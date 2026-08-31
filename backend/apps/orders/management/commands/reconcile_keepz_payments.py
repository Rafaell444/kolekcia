from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from apps.orders.keepz import KeepzGatewayError, get_keepz_order_status
from apps.orders.models import PaymentSession
from apps.orders.views import _apply_verified_keepz_status


class Command(BaseCommand):
    help = "Verify and reconcile Keepz payments that did not finish through the callback."

    def add_arguments(self, parser):
        parser.add_argument("--order-number", help="Reconcile one shop order by order number.")

    def handle(self, *args, **options):
        queryset = PaymentSession.objects.select_related("order").filter(
            provider=PaymentSession.PROVIDER_KEEPZ,
        ).filter(
            Q(status__in=(PaymentSession.STATUS_CREATED, PaymentSession.STATUS_REDIRECTED))
            | Q(status=PaymentSession.STATUS_SUCCESS, order__status="pending_payment")
            | Q(
                status=PaymentSession.STATUS_SUCCESS,
                order__isnull=False,
                order__confirmation_email_sent_at__isnull=True,
            )
        )
        order_number = options.get("order_number")
        if order_number:
            queryset = queryset.filter(order__order_number=order_number)
            if not queryset.exists():
                raise CommandError(f"No reconcilable payment found for {order_number}.")

        reconciled = failed = 0
        for payment in queryset.order_by("created_at"):
            try:
                provider_status = get_keepz_order_status(str(payment.integrator_order_id))
                status = _apply_verified_keepz_status(payment.pk, provider_status)
                label = payment.order.order_number if payment.order_id else str(payment.integrator_order_id)
                self.stdout.write(self.style.SUCCESS(f"{label}: {status}"))
                reconciled += 1
            except (KeepzGatewayError, ValueError) as exc:
                failed += 1
                self.stderr.write(self.style.ERROR(f"{payment.integrator_order_id}: {exc}"))

        self.stdout.write(f"Reconciled: {reconciled}; failed: {failed}")
