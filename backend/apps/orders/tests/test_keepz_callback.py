from unittest.mock import patch
from datetime import timedelta

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from django.utils import timezone

from apps.emails.models import EmailLog
from apps.orders.models import Order, OrderItem, OrderStatusHistory, PaymentSession, StockReservation
from apps.products.models import Product, SizeVariant
from apps.users.models import User


@override_settings(
    KEEPZ_INTEGRATOR_ID="9b22e5ba-573b-429c-be00-73c8e22ceeaf",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class KeepzCallbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="buyer@example.com", password="test-password")
        self.order = Order.objects.create(
            user=self.user,
            order_number="KOL-TEST-KEEPZ",
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

    def callback_payload(self, callback_status="SUCCESS"):
        return {
            "amount": 10,
            "integratorId": "9b22e5ba-573b-429c-be00-73c8e22ceeaf",
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": callback_status,
            "initialCurrency": "GEL",
            "transactionId": 12345,
        }

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_success_is_applied_only_after_keepz_status_verification(self, get_status):
        self.client.force_authenticate(self.user)
        pending_results = self.client.get("/api/orders/").json()["results"]
        self.assertEqual(len(pending_results), 1)
        self.assertEqual(pending_results[0]["payment_status"], PaymentSession.STATUS_REDIRECTED)
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "transactionId": 12345,
        }

        response = self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_SUCCESS)
        self.assertEqual(self.order.status, "processing")
        self.assertEqual(self.payment.provider_transaction_id, "12345")
        self.assertIsNotNone(self.order.confirmation_email_sent_at)
        paid_results = self.client.get("/api/orders/").json()["results"]
        self.assertEqual(len(paid_results), 1)
        self.assertEqual(paid_results[0]["payment_status"], PaymentSession.STATUS_SUCCESS)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_customer_return_reconciles_a_successful_payment_without_callback(self, get_status):
        self.client.force_authenticate(self.user)
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "transactionId": 67890,
        }

        response = self.client.post(f"/api/orders/{self.order.id}/payment-status/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_SUCCESS)
        self.assertEqual(self.order.status, "processing")
        self.assertEqual(response.json()["order"]["payment_status"], PaymentSession.STATUS_SUCCESS)
        self.assertEqual(response.json()["order"]["payment_transaction_id"], "67890")
        self.assertIsNotNone(self.order.confirmation_email_sent_at)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_duplicate_success_sends_order_confirmation_once(self, get_status):
        self.client.force_authenticate(self.user)
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "transactionId": 12345,
        }

        first = self.client.post("/api/orders/payments/keepz/callback/", self.callback_payload(), format="json")
        second = self.client.post("/api/orders/payments/keepz/callback/", self.callback_payload(), format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(EmailLog.objects.filter(event_key="order_confirmed", status="sent").count(), 1)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_callback_success_cannot_override_verified_failure(self, get_status):
        product = Product.objects.create(title="Reserved product", base_price="10.00")
        variant = SizeVariant.objects.create(
            product=product,
            label="A3",
            price_gel="10.00",
            price_usd="4.00",
            stock=1,
        )
        order_item = OrderItem.objects.create(
            order=self.order,
            size_variant=variant,
            product_title=product.title,
            size_label=variant.label,
            finish_label="",
            frame_label="",
            price="10.00",
            quantity=1,
        )
        reservation = StockReservation.objects.create(
            order=self.order,
            order_item=order_item,
            size_variant=variant,
            quantity=1,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "FAILED",
            "transactionId": 12345,
        }

        response = self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("SUCCESS"),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_FAILED)
        self.assertEqual(self.order.status, "payment_failed")
        variant.refresh_from_db()
        self.assertEqual(variant.stock, 1)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, StockReservation.STATUS_RELEASED)

        duplicate = self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("FAILED"),
            format="json",
        )
        self.assertEqual(duplicate.status_code, 200)
        variant.refresh_from_db()
        self.assertEqual(variant.stock, 1)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_success_finalizes_reserved_stock_once(self, get_status):
        product = Product.objects.create(title="Reserved product", base_price="10.00")
        variant = SizeVariant.objects.create(
            product=product,
            label="A3",
            price_gel="10.00",
            price_usd="4.00",
            stock=1,
            is_ready_to_ship=True,
        )
        order_item = OrderItem.objects.create(
            order=self.order,
            size_variant=variant,
            product_title=product.title,
            size_label=variant.label,
            finish_label="",
            frame_label="",
            price="10.00",
            quantity=1,
        )
        reservation = StockReservation.objects.create(
            order=self.order,
            order_item=order_item,
            size_variant=variant,
            quantity=1,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "transactionId": 12345,
        }

        first = self.client.post("/api/orders/payments/keepz/callback/", self.callback_payload(), format="json")
        second = self.client.post("/api/orders/payments/keepz/callback/", self.callback_payload(), format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        variant.refresh_from_db()
        reservation.refresh_from_db()
        self.assertEqual(variant.stock, 0)
        self.assertTrue(variant.is_ready_to_ship)
        self.assertEqual(reservation.status, StockReservation.STATUS_FINALIZED)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_expired_payment_releases_stock_without_decrement(self, get_status):
        product = Product.objects.create(title="Expiring product", base_price="10.00")
        variant = SizeVariant.objects.create(
            product=product,
            label="A4",
            price_gel="10.00",
            price_usd="4.00",
            stock=1,
        )
        order_item = OrderItem.objects.create(
            order=self.order,
            size_variant=variant,
            product_title=product.title,
            size_label=variant.label,
            finish_label="",
            frame_label="",
            price="10.00",
            quantity=1,
        )
        reservation = StockReservation.objects.create(
            order=self.order,
            order_item=order_item,
            size_variant=variant,
            quantity=1,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "EXPIRED",
            "transactionId": 12345,
        }

        response = self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("EXPIRED"),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        variant.refresh_from_db()
        reservation.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_EXPIRED)
        self.assertEqual(variant.stock, 1)
        self.assertEqual(reservation.status, StockReservation.STATUS_RELEASED)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_amount_mismatch_is_rejected_before_status_lookup(self, get_status):
        payload = self.callback_payload()
        payload["amount"] = 9.99

        response = self.client.post(
            "/api/orders/payments/keepz/callback/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        get_status.assert_not_called()
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_REDIRECTED)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_duplicate_success_callback_does_not_finalize_twice(self, get_status):
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "transactionId": 12345,
        }
        payload = self.callback_payload()

        first = self.client.post("/api/orders/payments/keepz/callback/", payload, format="json")
        second = self.client.post("/api/orders/payments/keepz/callback/", payload, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(OrderStatusHistory.objects.filter(order=self.order, status="processing").count(), 1)
