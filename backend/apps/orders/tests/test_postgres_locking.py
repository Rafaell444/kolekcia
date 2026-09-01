from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from threading import Barrier, Event
from types import SimpleNamespace
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4

from django.db import OperationalError, connection, connections, transaction
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auctions.models import Auction, AuctionBid
from apps.auctions.services import reserve_auction_inventory
from apps.gamification.models import PointsMarketShippingPaymentSession
from apps.gamification.services import complete_shipping_payment_session
from apps.orders.inventory import InsufficientInventoryError, reserve_order_stock
from apps.orders.models import Cart, CartItem, Order, OrderItem, PaymentSession, StockReservation
from apps.orders.payment_service import (
    apply_verified_keepz_status,
    expire_payment_session,
    lock_payment_session,
    reconcile_keepz_payments,
)
from apps.products.models import Product, SizeVariant
from apps.users.models import User


class PaymentFixture:
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(email="locking@example.com", password="test-password")
        self.product = Product.objects.create(title="Locking test", base_price="10.00")
        self.variant = SizeVariant.objects.create(
            product=self.product, label="Standard", price_gel="10.00",
            price_usd="10.00", stock=1, is_ready_to_ship=True,
        )
        self.order = self.make_order("LOCK-1")
        self.payment = self.make_payment(self.order)

    def make_order(self, number):
        order = Order.objects.create(
            user=self.user, order_number=number, status="pending_payment",
            shipping_name="Test Buyer", shipping_email=self.user.email,
            shipping_line1="Test Street 1", shipping_city="Tbilisi",
            shipping_state="Tbilisi", shipping_zip="0105", shipping_country="GE",
            subtotal="10.00", total="10.00", currency="GEL",
        )
        OrderItem.objects.create(
            order=order, size_variant=self.variant, product_title=self.product.title,
            price="10.00", quantity=1,
        )
        return order

    def make_payment(self, order):
        return PaymentSession.objects.create(
            purpose=PaymentSession.PURPOSE_CHECKOUT, status=PaymentSession.STATUS_REDIRECTED,
            user=self.user, order=order, amount="10.00", currency="GEL",
        )

    def success(self, payment=None):
        payment = payment or self.payment
        return {
            "integratorOrderId": str(payment.integrator_order_id),
            "status": "SUCCESS", "amount": "10.00", "currency": "GEL",
        }

    def apply_success(self, payment=None):
        payment = payment or self.payment
        return apply_verified_keepz_status(payment.pk, self.success(payment))


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PaymentLockRegressionTests(PaymentFixture, TestCase):
    def test_late_success_after_expiry_still_deducts_stock(self):
        reserve_order_stock(self.order)
        expire_payment_session(self.payment.pk)
        with patch("apps.orders.payment_service.send_order_confirmation", return_value=True):
            self.assertEqual(self.apply_success(), PaymentSession.STATUS_SUCCESS)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)
        self.assertEqual(StockReservation.objects.get(order=self.order).status, "finalized")

    def test_late_success_does_not_take_another_buyers_reservation(self):
        for released in (False, True):
            with self.subTest(released=released):
                StockReservation.objects.all().delete()
                PaymentSession.objects.filter(pk=self.payment.pk).update(status="redirected")
                reserve_order_stock(self.order)
                if released:
                    expire_payment_session(self.payment.pk)
                else:
                    StockReservation.objects.filter(order=self.order).update(
                        expires_at=timezone.now() - timedelta(seconds=1)
                    )
                other_order = self.make_order(f"OTHER-{released}")
                reserve_order_stock(other_order)
                self.assertEqual(self.apply_success(), PaymentSession.STATUS_NEEDS_REVIEW)
                self.variant.refresh_from_db()
                self.assertEqual(self.variant.stock, 1)
                self.assertEqual(StockReservation.objects.get(order=other_order).status, "active")
                with patch("apps.orders.payment_service.send_order_confirmation", return_value=True):
                    self.assertEqual(self.apply_success(self.make_payment(other_order)), "success")
                # Restore the fixture for the other late-payment scenario.
                SizeVariant.objects.filter(pk=self.variant.pk).update(stock=1)

    def test_cart_quantity_update_with_optional_variant(self):
        self.variant.stock = 3
        self.variant.save(update_fields=["stock"])
        cart = Cart.objects.create(user=self.user)
        item = CartItem.objects.create(cart=cart, size_variant=self.variant, quantity=1)
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.patch(f"/api/orders/cart/items/{item.pk}/", {"quantity": 2})
        self.assertEqual(response.status_code, 200, response.data)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 2)

    def test_deleted_points_item_returns_domain_error_not_lock_error(self):
        session = PointsMarketShippingPaymentSession.objects.create(
            token=uuid4(), user=self.user, market_item=None, item_name="Deleted reward",
            point_cost=1, shipping_price="1.00",
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        with self.assertRaisesMessage(ValueError, "no longer available"):
            complete_shipping_payment_session(self.user, session.token)

    def test_review_reason_survives_reconciliation(self):
        PaymentSession.objects.filter(pk=self.payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=10)
        )
        report = reconcile_keepz_payments(
            status_fetcher=lambda _: {**self.success(), "amount": "1.00"}
        )
        self.assertEqual(report.needs_review, 1)
        self.payment.refresh_from_db()
        self.assertIn("Amount mismatch", self.payment.last_error)

    def test_auction_cannot_take_checkout_reserved_stock(self):
        reserve_order_stock(self.order)
        auction = Auction.objects.create(
            product=self.product, title="Reserved unit", starting_bid="10.00",
            ends_at=timezone.now() + timedelta(hours=1),
        )
        from rest_framework.exceptions import ValidationError
        with self.assertRaisesMessage(ValidationError, "reserved by a checkout"):
            reserve_auction_inventory(auction, self.variant.pk)

    @override_settings(KEEPZ_ENABLED=True)
    def test_winner_payment_with_nullable_vendor(self):
        auction = Auction.objects.create(
            title="Winner payment", starting_bid="9.00", winner=self.user,
            ends_at=timezone.now() - timedelta(minutes=1),
        )
        AuctionBid.objects.create(auction=auction, user=self.user, amount="10.00")
        client = APIClient()
        client.force_authenticate(self.user)
        result = SimpleNamespace(
            payment_url="https://example.com/test-only", request_payload={}, provider_payload={}
        )
        with patch("apps.orders.keepz.create_keepz_order_for_auction", return_value=result):
            response = client.post(f"/api/auctions/{auction.pk}/payment/", {"currency": "USD"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["payment_required"])


@skipUnless(connection.vendor == "postgresql", "Requires real PostgreSQL row locks")
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PostgreSQLConcurrencyTests(PaymentFixture, TransactionTestCase):
    def worker(self, fn):
        connections.close_all()
        try:
            # A broken lock ordering fails the test instead of hanging CI.
            with connection.cursor() as cursor:
                cursor.execute("SET statement_timeout = '10s'")
            return fn()
        finally:
            connections.close_all()

    def parallel(self, *functions):
        gate = Barrier(len(functions))

        def run(fn):
            gate.wait(timeout=10)
            return self.worker(fn)

        with ThreadPoolExecutor(max_workers=len(functions)) as executor:
            futures = [executor.submit(run, fn) for fn in functions]
            return [future.result(timeout=20) for future in futures]

    def test_payment_row_lock_blocks_competitor_but_not_unrelated_payment(self):
        other = PaymentSession.objects.create(
            purpose="custom_order", amount="10.00", currency="GEL"
        )

        def probe():
            with transaction.atomic():
                PaymentSession.objects.select_for_update(nowait=True).get(pk=other.pk)
            try:
                with transaction.atomic():
                    PaymentSession.objects.select_for_update(nowait=True).get(pk=self.payment.pk)
            except OperationalError as exc:
                return exc.__cause__.pgcode
            return "not locked"

        with ThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic():
                lock_payment_session(self.payment.pk)
                self.assertEqual(executor.submit(self.worker, probe).result(timeout=15), "55P03")
            self.assertEqual(executor.submit(self.worker, probe).result(timeout=15), "not locked")

    def test_duplicate_callbacks_deduct_only_once(self):
        reserve_order_stock(self.order)
        with patch("apps.orders.payment_service.send_order_confirmation", return_value=True):
            self.assertEqual(self.parallel(self.apply_success, self.apply_success), ["success", "success"])
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)
        self.assertEqual(self.order.status_history.filter(status="processing").count(), 1)

    def test_two_payment_attempts_cannot_fulfill_same_order_twice(self):
        reserve_order_stock(self.order)
        second = self.make_payment(self.order)
        with patch("apps.orders.payment_service.send_order_confirmation", return_value=True):
            self.parallel(self.apply_success, lambda: self.apply_success(second))
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)
        self.assertEqual(self.order.status_history.filter(status="processing").count(), 1)

    def test_success_racing_expiration_keeps_paid_stock_consistent(self):
        reserve_order_stock(self.order)
        with patch("apps.orders.payment_service.send_order_confirmation", return_value=True):
            self.parallel(self.apply_success, lambda: expire_payment_session(self.payment.pk))
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertEqual(self.payment.status, "success")
        self.assertEqual(self.order.status, "processing")
        self.assertEqual(self.variant.stock, 0)

    def test_last_unit_can_only_be_reserved_by_one_order(self):
        other = self.make_order("LOCK-2")

        def reserve(order):
            try:
                reserve_order_stock(order)
                return "reserved"
            except InsufficientInventoryError:
                return "unavailable"

        results = self.parallel(lambda: reserve(self.order), lambda: reserve(other))
        self.assertCountEqual(results, ["reserved", "unavailable"])
        self.assertEqual(StockReservation.objects.filter(status="active").count(), 1)

    @override_settings(KEEPZ_ENABLED=True)
    def test_concurrent_checkout_replays_one_payment_for_same_cart(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(
            cart=cart, size_variant=self.variant, quantity=1,
            unit_price="10.00", currency="GEL",
        )

        def checkout():
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=self.user.pk))
            response = client.post("/api/orders/checkout/", {
                "shipping_name": "Test Buyer", "shipping_email": self.user.email,
                "shipping_line1": "Test Street 1", "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi", "shipping_zip": "0105",
                "shipping_country": "GE", "currency": "GEL",
            }, format="json", HTTP_IDEMPOTENCY_KEY="concurrent-checkout")
            self.assertEqual(response.status_code, 201, response.data)
            return response.data["payment_id"]

        result = SimpleNamespace(
            payment_url="https://example.com/test-only", request_payload={}, provider_payload={}
        )
        with patch("apps.orders.keepz.create_keepz_order_for_checkout", return_value=result) as gateway:
            payment_ids = self.parallel(checkout, checkout)
        self.assertEqual(payment_ids[0], payment_ids[1])
        gateway.assert_called_once()
        self.assertEqual(Order.objects.filter(checkout_idempotency_key="concurrent-checkout").count(), 1)
        self.assertEqual(StockReservation.objects.filter(status="active").count(), 1)

    def test_opposite_item_order_cannot_deadlock_multi_product_reservations(self):
        other = self.make_order("MULTI-2")
        second_variant = SizeVariant.objects.create(
            product=self.product, label="Second", stock=1,
            price_gel="10.00", price_usd="10.00",
        )
        other.items.update(size_variant=second_variant)
        for order, variant in [(other, self.variant), (self.order, second_variant)]:
            OrderItem.objects.create(
                order=order, size_variant=variant, price="10.00",
                quantity=1, product_title="Second variant",
            )

        def reserve(order):
            try:
                reserve_order_stock(order)
                return True
            except InsufficientInventoryError:
                return False

        self.assertCountEqual(
            self.parallel(lambda: reserve(self.order), lambda: reserve(other)),
            [True, False],
        )
        self.assertEqual(StockReservation.objects.filter(status="active").count(), 2)

    def test_two_finalizers_assign_and_notify_winner_once(self):
        auction = Auction.objects.create(
            title="Finalizing race", starting_bid="10.00",
            ends_at=timezone.now() - timedelta(minutes=1),
        )
        AuctionBid.objects.create(auction=auction, user=self.user, amount="11.00")

        def finalize():
            return Auction.objects.get(pk=auction.pk).finalize_if_ended()

        with patch.object(Auction, "_send_auction_won_email") as notify:
            self.parallel(finalize, finalize)
        notify.assert_called_once()
        auction.refresh_from_db()
        self.assertEqual(auction.winner_id, self.user.pk)

    def test_reconciliation_lock_is_released_after_exception(self):
        with patch("apps.orders.payment_service._sessions_needing_repair", side_effect=RuntimeError("test")):
            with self.assertRaisesMessage(RuntimeError, "test"):
                reconcile_keepz_payments()
        with ThreadPoolExecutor(max_workers=1) as executor:
            report = executor.submit(self.worker, lambda: reconcile_keepz_payments()).result(timeout=15)
        self.assertFalse(report.skipped)

    def test_overlapping_reconciliation_skips_but_webhook_can_complete(self):
        reserve_order_stock(self.order)
        PaymentSession.objects.filter(pk=self.payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=10)
        )
        entered, release = Event(), Event()

        def fetch(_):
            entered.set()
            if not release.wait(timeout=10):
                raise RuntimeError("Test worker timed out")
            return {**self.success(), "status": "PROCESSING"}

        with patch("apps.orders.payment_service.send_order_confirmation", return_value=True):
            with ThreadPoolExecutor(max_workers=1) as executor:
                first = executor.submit(self.worker, lambda: reconcile_keepz_payments(status_fetcher=fetch))
                try:
                    self.assertTrue(entered.wait(timeout=10))
                    with patch("apps.orders.payment_service._default_status_fetcher") as provider:
                        self.assertTrue(reconcile_keepz_payments().skipped)
                        provider.assert_not_called()
                    self.assertEqual(self.apply_success(), "success")
                finally:
                    release.set()
                self.assertEqual(first.result(timeout=15).failed, 0)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)
        # Completion released the advisory lock for subsequent runs.
        report = reconcile_keepz_payments(status_fetcher=lambda _: self.success())
        self.assertFalse(report.skipped)

    def test_simultaneous_equal_bids_only_accept_one(self):
        other_user = User.objects.create_user(email="bidder@example.com", password="test-password")
        auction = Auction.objects.create(
            title="Concurrent bidding", starting_bid="10.00",
            starts_at=timezone.now() - timedelta(minutes=1),
            ends_at=timezone.now() + timedelta(hours=1),
        )

        def bid(user_id):
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=user_id))
            response = client.post(f"/api/auctions/{auction.pk}/bid/", {
                "amount": "11.00", "currency": "USD", "shipping_name": "Test Bidder",
                "shipping_line1": "Test Street 1", "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi", "shipping_zip": "0105",
                "shipping_country": "GE", "shipping_phone": "+995555000000",
            })
            return response.status_code

        with patch("apps.auctions.services.get_usd_gel_rate", return_value=Decimal("2.7")):
            codes = self.parallel(lambda: bid(self.user.pk), lambda: bid(other_user.pk))
        self.assertCountEqual(codes, [201, 400])
        self.assertEqual(AuctionBid.objects.filter(auction=auction).count(), 1)
