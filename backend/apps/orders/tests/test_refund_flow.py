from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderItem, PaymentSession
from apps.orders.refunds import settle_refund
from apps.products.models import Product, SizeVariant
from apps.users.models import User


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    KEEPZ_ENABLED=False,
)
class RefundFlowTestCase(TestCase):
    """A paid order that gets refunded, and the guard against cancelling instead."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@example.com", password="test-password", is_staff=True
        )
        self.user = User.objects.create_user(
            email="buyer@example.com", password="test-password"
        )
        self.order = Order.objects.create(
            user=self.user,
            order_number="KOL-TEST-REFUND",
            status="processing",
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
            status=PaymentSession.STATUS_SUCCESS,
            user=self.user,
            order=self.order,
            amount="10.00",
            currency="GEL",
        )
        product = Product.objects.create(title="Refunded product", base_price="10.00")
        variant = SizeVariant.objects.create(
            product=product, label="A3", price_gel="10.00", price_usd="4.00", stock=1
        )
        OrderItem.objects.create(
            order=self.order,
            size_variant=variant,
            product_title=product.title,
            size_label=variant.label,
            finish_label="",
            frame_label="",
            price="10.00",
            quantity=1,
        )

    def test_refund_emails_the_customer_once(self):
        mail.outbox = []
        outcome = settle_refund(self.order, amount=self.order.total)

        self.assertTrue(outcome.email_sent)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.order.order_number, mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, [self.user.email])

        self.order.refresh_from_db()
        self.assertIsNotNone(self.order.refund_email_sent_at)

        # A retry of the same settlement must not email the customer twice.
        settle_refund(self.order, amount=self.order.total)
        self.assertEqual(len(mail.outbox), 1)

    def test_internal_note_is_not_leaked_to_the_customer(self):
        mail.outbox = []
        settle_refund(self.order, note="Keepz payment status: REFUNDED_BY_OPERATOR")

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        body = sent.body + str(getattr(sent, "alternatives", "") or "")
        self.assertNotIn("REFUNDED_BY_OPERATOR", body)

    def test_cancelling_a_paid_order_is_blocked_without_confirmation(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/admin/orders/{self.order.pk}/", {"status": "cancelled"}, format="json"
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.data["code"], "paid_order_cancel_requires_confirmation"
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "processing")

    def test_cancelling_a_paid_order_succeeds_when_confirmed(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/admin/orders/{self.order.pk}/",
            {"status": "cancelled", "confirm_keep_payment": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "cancelled")

    def test_cancelling_an_unpaid_order_needs_no_confirmation(self):
        self.payment.status = PaymentSession.STATUS_REDIRECTED
        self.payment.save(update_fields=["status"])
        self.order.status = "pending_payment"
        self.order.save(update_fields=["status"])

        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/admin/orders/{self.order.pk}/", {"status": "cancelled"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "cancelled")
