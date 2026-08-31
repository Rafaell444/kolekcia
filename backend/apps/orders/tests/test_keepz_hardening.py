from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
    PaymentSession,
    StockReservation,
)
from apps.orders.payment_service import (
    expire_stale_payments,
    reconcile_keepz_payments,
    verify_provider_amount,
)
from apps.products.models import Product, SizeVariant
from apps.users.models import User


@override_settings(
    KEEPZ_INTEGRATOR_ID="9b22e5ba-573b-429c-be00-73c8e22ceeaf",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class KeepzHardeningTestCase(TestCase):
    """Shared fixture: one pending order with a single reserved unit of stock."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="buyer@example.com", password="test-password")
        self.order = Order.objects.create(
            user=self.user,
            order_number="KOL-TEST-HARDENING",
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
        self.product = Product.objects.create(title="Held product", base_price="10.00")
        self.variant = SizeVariant.objects.create(
            product=self.product,
            label="A3",
            price_gel="10.00",
            price_usd="4.00",
            stock=1,
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            size_variant=self.variant,
            product_title=self.product.title,
            size_label=self.variant.label,
            finish_label="",
            frame_label="",
            price="10.00",
            quantity=1,
        )
        self.reservation = StockReservation.objects.create(
            order=self.order,
            order_item=self.order_item,
            size_variant=self.variant,
            quantity=1,
            expires_at=timezone.now() + timedelta(minutes=15),
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

    def age_payment(self, **delta):
        PaymentSession.objects.filter(pk=self.payment.pk).update(
            created_at=timezone.now() - timedelta(**delta)
        )


class VerifiedAmountTests(KeepzHardeningTestCase):
    def test_matching_amount_and_currency_passes(self):
        self.assertIsNone(
            verify_provider_amount(
                self.payment,
                {"status": "SUCCESS", "amount": "10.00", "currency": "GEL"},
            )
        )

    def test_absent_amount_passes_unless_strict_mode_is_on(self):
        self.assertIsNone(verify_provider_amount(self.payment, {"status": "SUCCESS"}))

    @override_settings(KEEPZ_REQUIRE_AMOUNT_VERIFICATION=True)
    def test_absent_amount_is_rejected_in_strict_mode(self):
        reason = verify_provider_amount(self.payment, {"status": "SUCCESS"})
        self.assertIn("omitted the paid amount", reason)

    def test_underpayment_is_reported(self):
        reason = verify_provider_amount(
            self.payment, {"status": "SUCCESS", "amount": "1.00", "currency": "GEL"}
        )
        self.assertIn("Amount mismatch", reason)

    def test_currency_swap_is_reported(self):
        reason = verify_provider_amount(
            self.payment, {"status": "SUCCESS", "amount": "10.00", "currency": "USD"}
        )
        self.assertIn("Currency mismatch", reason)


class VerifiedAmountMismatchHoldsFulfillmentTests(KeepzHardeningTestCase):
    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_underpaid_success_is_quarantined_and_stock_stays_reserved(self, get_status):
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "1.00",
            "currency": "GEL",
            "transactionId": 12345,
        }

        response = self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.variant.refresh_from_db()
        self.reservation.refresh_from_db()

        self.assertEqual(self.payment.status, PaymentSession.STATUS_NEEDS_REVIEW)
        self.assertIn("Amount mismatch", self.payment.last_error)
        # No fulfillment: order untouched, stock neither drawn down nor freed.
        self.assertEqual(self.order.status, "pending_payment")
        self.assertIsNone(self.order.confirmation_email_sent_at)
        self.assertEqual(self.variant.stock, 1)
        self.assertEqual(self.reservation.status, StockReservation.STATUS_ACTIVE)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_review_hold_extends_the_reservation_so_stock_is_not_resold(self, get_status):
        original_expiry = self.reservation.expires_at
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "1.00",
            "currency": "GEL",
        }

        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )

        self.reservation.refresh_from_db()
        self.assertGreater(self.reservation.expires_at, original_expiry + timedelta(days=1))

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_quarantined_payment_is_not_reopened_by_a_later_callback(self, get_status):
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "1.00",
            "currency": "GEL",
        }
        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )

        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "FAILED",
        }
        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload("FAILED"), format="json"
        )

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_NEEDS_REVIEW)


class RejectedStatusTests(KeepzHardeningTestCase):
    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_rejected_marks_payment_failed_and_releases_inventory(self, get_status):
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "REJECTED",
        }

        response = self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload("REJECTED"), format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.variant.refresh_from_db()
        self.reservation.refresh_from_db()

        self.assertEqual(self.payment.status, PaymentSession.STATUS_FAILED)
        self.assertEqual(self.order.status, "payment_failed")
        self.assertEqual(self.variant.stock, 1)
        self.assertEqual(self.reservation.status, StockReservation.STATUS_RELEASED)


class OversoldAfterPaymentTests(KeepzHardeningTestCase):
    """The reservation lapsed, someone else took the stock, then payment landed."""

    def resell_the_stock(self):
        StockReservation.objects.filter(pk=self.reservation.pk).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        SizeVariant.objects.filter(pk=self.variant.pk).update(stock=0)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_payment_is_quarantined_instead_of_erroring(self, get_status):
        self.resell_the_stock()
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "10.00",
            "currency": "GEL",
        }

        response = self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_NEEDS_REVIEW)
        self.assertIn("stock could no longer be fulfilled", self.payment.last_error)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_partial_stock_writes_are_rolled_back(self, get_status):
        self.resell_the_stock()
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "10.00",
            "currency": "GEL",
        }

        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )

        self.variant.refresh_from_db()
        self.reservation.refresh_from_db()
        # Stock was not driven negative and the reservation was not consumed.
        self.assertEqual(self.variant.stock, 0)
        self.assertEqual(self.reservation.status, StockReservation.STATUS_ACTIVE)

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_a_paid_order_is_never_expired_by_the_cleanup_job(self, get_status):
        self.resell_the_stock()
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "10.00",
            "currency": "GEL",
        }
        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )
        self.age_payment(hours=48)

        self.assertEqual(expire_stale_payments(), 0)

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_NEEDS_REVIEW)
        self.assertNotEqual(self.order.status, "expired")

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_the_payment_is_still_recorded_as_paid(self, get_status):
        self.resell_the_stock()
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "10.00",
            "currency": "GEL",
            "transactionId": 4321,
        }

        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )

        self.payment.refresh_from_db()
        self.assertIsNotNone(self.payment.paid_at)
        self.assertEqual(self.payment.provider_transaction_id, "4321")


class RefundStatusTests(KeepzHardeningTestCase):
    def pay(self, get_status):
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "10.00",
            "currency": "GEL",
        }
        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_refund_after_success_stops_fulfillment(self, get_status):
        self.pay(get_status)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "processing")

        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "REFUNDED_BY_KEEPZ",
        }
        response = self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("REFUNDED_BY_KEEPZ"),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_REFUNDED)
        self.assertEqual(self.order.status, "refunded")

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_partial_refund_settles_only_the_amount_returned(self, get_status):
        self.pay(get_status)
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "PARTIALLY_REFUNDED",
            "refundedAmount": "4.00",
        }

        self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("PARTIALLY_REFUNDED"),
            format="json",
        )

        self.order.refresh_from_db()
        # The unrefunded remainder is still owed to the customer, so the order
        # must not be written off as fully refunded.
        self.assertEqual(self.order.status, "partially_refunded")
        self.assertEqual(self.order.refunded_total, Decimal("4.00"))

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_partial_refund_without_an_amount_is_quarantined(self, get_status):
        self.pay(get_status)
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "PARTIALLY_REFUNDED",
        }

        self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("PARTIALLY_REFUNDED"),
            format="json",
        )

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_NEEDS_REVIEW)
        # Nothing was reversed on a guess about the amount.
        self.assertEqual(self.order.refunded_total, Decimal("0"))

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_failed_refund_leaves_the_payment_successful(self, get_status):
        self.pay(get_status)
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "REFUNDED_FAILED",
        }

        self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("REFUNDED_FAILED"),
            format="json",
        )

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_SUCCESS)
        self.assertEqual(self.order.status, "processing")

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_gateway_refund_reverses_points_like_an_admin_refund_does(self, get_status):
        """A Keepz-side refund must not leave the customer holding the points."""
        self.pay(get_status)
        from apps.gamification.models import PointTransaction

        earned = PointTransaction.objects.filter(
            order=self.order, transaction_type=PointTransaction.TYPE_EARNED
        ).first()
        self.assertIsNotNone(earned, "fixture should have earned points on payment")

        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "REFUNDED_BY_KEEPZ",
        }
        self.client.post(
            "/api/orders/payments/keepz/callback/",
            self.callback_payload("REFUNDED_BY_KEEPZ"),
            format="json",
        )

        earned.refresh_from_db()
        self.assertEqual(earned.status, PointTransaction.STATUS_CANCELLED)
        self.assertTrue(
            PointTransaction.objects.filter(
                order=self.order,
                transaction_type=PointTransaction.TYPE_REFUND_REVERSAL,
            ).exists()
        )

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_refund_is_idempotent(self, get_status):
        self.pay(get_status)
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "REFUNDED_BY_OPERATOR",
        }
        payload = self.callback_payload("REFUNDED_BY_OPERATOR")

        self.client.post("/api/orders/payments/keepz/callback/", payload, format="json")
        self.client.post("/api/orders/payments/keepz/callback/", payload, format="json")

        self.assertEqual(
            OrderStatusHistory.objects.filter(order=self.order, status="refunded").count(), 1
        )


class ReservationWindowTests(KeepzHardeningTestCase):
    def test_reservation_outlives_the_keepz_payment_window(self):
        from django.conf import settings

        self.assertGreater(
            settings.PAYMENT_STOCK_RESERVATION_MINUTES,
            settings.KEEPZ_PAYMENT_WINDOW_MINUTES,
        )

    @override_settings(KEEPZ_ORDER_EXPIRY_ENABLED=False)
    def test_valid_until_is_omitted_without_keepz_permission(self):
        from apps.orders.keepz import _apply_order_expiry

        payload = {}
        _apply_order_expiry(payload)
        self.assertNotIn("validUntil", payload)

    @override_settings(KEEPZ_ORDER_EXPIRY_ENABLED=True, KEEPZ_PAYMENT_WINDOW_MINUTES=5)
    def test_valid_until_uses_the_format_keepz_documents(self):
        import re

        from apps.orders.keepz import _apply_order_expiry

        payload = {}
        _apply_order_expiry(payload)
        self.assertRegex(payload["validUntil"], r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")


class ExpiryTests(KeepzHardeningTestCase):
    def test_payment_inside_the_window_is_not_expired(self):
        self.age_payment(hours=2)

        self.assertEqual(expire_stale_payments(), 0)

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_REDIRECTED)

    def test_payment_older_than_24h_is_expired_and_inventory_released(self):
        self.age_payment(hours=25)

        self.assertEqual(expire_stale_payments(), 1)

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.variant.refresh_from_db()
        self.reservation.refresh_from_db()

        self.assertEqual(self.payment.status, PaymentSession.STATUS_EXPIRED)
        self.assertEqual(self.order.status, "expired")
        self.assertEqual(self.variant.stock, 1)
        self.assertEqual(self.reservation.status, StockReservation.STATUS_RELEASED)
        self.assertTrue(
            OrderStatusHistory.objects.filter(order=self.order, status="expired").exists()
        )

    def test_expiry_is_idempotent(self):
        self.age_payment(hours=25)

        self.assertEqual(expire_stale_payments(), 1)
        self.assertEqual(expire_stale_payments(), 0)

    def test_paid_payment_is_never_expired(self):
        PaymentSession.objects.filter(pk=self.payment.pk).update(
            status=PaymentSession.STATUS_SUCCESS
        )
        self.age_payment(hours=48)

        self.assertEqual(expire_stale_payments(), 0)

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_SUCCESS)

    def test_reconciliation_expires_instead_of_polling_beyond_the_window(self):
        self.age_payment(hours=30)
        fetcher = lambda _id: {"status": "SUCCESS"}  # noqa: E731

        report = reconcile_keepz_payments(status_fetcher=fetcher)

        self.assertEqual(report.expired, 1)
        self.assertEqual(report.checked, 0)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_EXPIRED)


class ReconciliationServiceTests(KeepzHardeningTestCase):
    def test_stale_success_is_fulfilled_without_a_webhook(self):
        self.age_payment(minutes=10)

        report = reconcile_keepz_payments(
            status_fetcher=lambda _id: {
                "integratorOrderId": str(self.payment.integrator_order_id),
                "status": "SUCCESS",
                "amount": "10.00",
                "currency": "GEL",
            }
        )

        self.assertEqual(report.updated, 1)
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_SUCCESS)
        self.assertEqual(self.order.status, "processing")
        self.assertEqual(self.variant.stock, 0)

    def test_mismatched_amount_is_counted_as_needing_review(self):
        self.age_payment(minutes=10)

        report = reconcile_keepz_payments(
            status_fetcher=lambda _id: {
                "integratorOrderId": str(self.payment.integrator_order_id),
                "status": "SUCCESS",
                "amount": "999.00",
                "currency": "GEL",
            }
        )

        self.assertEqual(report.needs_review, 1)
        self.assertEqual(report.updated, 0)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_NEEDS_REVIEW)

    def test_identifier_mismatch_is_recorded_without_changing_state(self):
        self.age_payment(minutes=10)

        report = reconcile_keepz_payments(
            status_fetcher=lambda _id: {
                "integratorOrderId": "00000000-0000-0000-0000-000000000000",
                "status": "SUCCESS",
            }
        )

        self.assertEqual(report.failed, 1)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_REDIRECTED)
        self.assertIn("identifier mismatch", self.payment.last_error)

    def test_celery_task_delegates_to_the_service(self):
        self.age_payment(minutes=10)
        from apps.orders.tasks import reconcile_keepz_payments_task

        with patch("apps.orders.payment_service._default_status_fetcher") as fetcher:
            fetcher.return_value = {
                "integratorOrderId": str(self.payment.integrator_order_id),
                "status": "SUCCESS",
                "amount": "10.00",
                "currency": "GEL",
            }
            result = reconcile_keepz_payments_task.apply().get()

        self.assertEqual(result["updated"], 1)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_SUCCESS)


class OrderPaymentStatusEndpointTests(KeepzHardeningTestCase):
    def endpoint(self):
        return f"/api/orders/{self.order.id}/status/"

    def test_requires_authentication(self):
        self.assertEqual(self.client.get(self.endpoint()).status_code, 401)

    def test_pending_order_is_not_final_so_the_client_keeps_polling(self):
        self.client.force_authenticate(self.user)

        body = self.client.get(self.endpoint()).json()

        self.assertEqual(body["status"], "pending_payment")
        self.assertEqual(body["payment_status"], PaymentSession.STATUS_REDIRECTED)
        self.assertFalse(body["is_paid"])
        self.assertFalse(body["is_final"])

    @patch("apps.orders.keepz.get_keepz_order_status")
    def test_paid_order_reports_final(self, get_status):
        get_status.return_value = {
            "integratorOrderId": str(self.payment.integrator_order_id),
            "status": "SUCCESS",
            "amount": "10.00",
            "currency": "GEL",
        }
        self.client.post(
            "/api/orders/payments/keepz/callback/", self.callback_payload(), format="json"
        )
        self.client.force_authenticate(self.user)

        body = self.client.get(self.endpoint()).json()

        self.assertEqual(body["status"], "processing")
        self.assertTrue(body["is_paid"])
        self.assertTrue(body["is_final"])
        self.assertFalse(body["is_failed"])

    def test_another_user_cannot_read_the_order_status(self):
        intruder = User.objects.create_user(email="intruder@example.com", password="test-password")
        self.client.force_authenticate(intruder)

        self.assertEqual(self.client.get(self.endpoint()).status_code, 404)
