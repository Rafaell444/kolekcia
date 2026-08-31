from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.orders.models import Order, PaymentSession
from apps.users.models import User


@override_settings(
    KEEPZ_INTEGRATOR_ID="9b22e5ba-573b-429c-be00-73c8e22ceeaf",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class KeepzReconciliationCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="buyer@example.com", password="test-password")
        self.order = Order.objects.create(
            user=self.user,
            order_number="KOL-TEST-RECONCILE",
            status="pending_payment",
            shipping_name="Buyer Test",
            shipping_line1="Rustaveli 1",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0108",
            shipping_country="GE",
            shipping_email=self.user.email,
            subtotal="10.00",
            total="10.00",
            currency="GEL",
        )
        self.payment = PaymentSession.objects.create(
            purpose=PaymentSession.PURPOSE_CHECKOUT,
            status=PaymentSession.STATUS_REDIRECTED,
            user=self.user,
            order=self.order,
            amount="10.00",
            currency="GEL",
        )

    def make_stale(self):
        PaymentSession.objects.filter(pk=self.payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=3),
        )

    @patch("apps.orders.management.commands.reconcile_keepz_payments.get_keepz_order_status")
    def test_recent_payment_is_left_for_webhook(self, get_status):
        stdout = StringIO()

        call_command("reconcile_keepz_payments", stdout=stdout)

        get_status.assert_not_called()
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_REDIRECTED)
        self.assertIn("Checked: 0", stdout.getvalue())

    @patch("apps.orders.management.commands.reconcile_keepz_payments.get_keepz_order_status")
    def test_stale_success_is_finalized_after_provider_verification(self, get_status):
        self.make_stale()
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "transactionId": 98765,
        }

        call_command("reconcile_keepz_payments", stdout=StringIO())

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_SUCCESS)
        self.assertEqual(self.payment.provider_transaction_id, "98765")
        self.assertEqual(self.order.status, "processing")
        self.assertIsNotNone(self.order.confirmation_email_sent_at)

    @patch("apps.orders.management.commands.reconcile_keepz_payments.get_keepz_order_status")
    def test_provider_processing_status_keeps_local_payment_pending(self, get_status):
        self.make_stale()
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "PROCESSING",
        }
        stdout = StringIO()

        call_command("reconcile_keepz_payments", stdout=stdout)

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_REDIRECTED)
        self.assertEqual(self.order.status, "pending_payment")
        self.assertIn("still pending: 1", stdout.getvalue())

    @patch("apps.orders.management.commands.reconcile_keepz_payments.get_keepz_order_status")
    def test_provider_failure_is_recorded_without_changing_payment(self, get_status):
        self.make_stale()
        get_status.side_effect = RuntimeError("temporary failure")

        stdout = StringIO()
        call_command("reconcile_keepz_payments", stdout=stdout, stderr=StringIO())

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_REDIRECTED)
        self.assertEqual(self.payment.last_error, "temporary failure")
        self.assertIn("failed: 1", stdout.getvalue())
