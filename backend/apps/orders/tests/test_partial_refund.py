import uuid
from decimal import Decimal

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.gamification.models import PointTransaction
from apps.orders.models import Order, OrderItem, PaymentSession
from apps.orders.refunds import settle_refund
from apps.products.models import Product, SizeVariant
from apps.users.models import User


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    KEEPZ_ENABLED=False,
)
class PartialRefundTestCase(TestCase):
    """A three-item order where only one item comes back."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@example.com", password="pw", is_staff=True
        )
        self.user = User.objects.create_user(email="buyer@example.com", password="pw")
        self.order = Order.objects.create(
            user=self.user,
            order_number="KOL-PARTIAL",
            status="processing",
            shipping_name="Buyer",
            shipping_line1="Rustaveli 1",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0108",
            shipping_country="GE",
            shipping_email=self.user.email,
            subtotal="30.00",
            total="30.00",
            currency="GEL",
        )
        PaymentSession.objects.create(
            purpose=PaymentSession.PURPOSE_CHECKOUT,
            status=PaymentSession.STATUS_SUCCESS,
            user=self.user,
            order=self.order,
            amount="30.00",
            currency="GEL",
        )
        product = Product.objects.create(title="Panel", base_price="10.00")
        self.items = []
        for idx in range(3):
            variant = SizeVariant.objects.create(
                product=product,
                label=f"S{idx}",
                price_gel="10.00",
                price_usd="4.00",
                stock=5,
            )
            self.items.append(
                OrderItem.objects.create(
                    order=self.order,
                    size_variant=variant,
                    product_title=f"Panel {idx}",
                    size_label=variant.label,
                    finish_label="",
                    frame_label="",
                    price="10.00",
                    quantity=1,
                )
            )
        # 30 points earned on the order, all available.
        PointTransaction.objects.create(
            user=self.user,
            order=self.order,
            transaction_type=PointTransaction.TYPE_EARNED,
            status=PointTransaction.STATUS_AVAILABLE,
            points=30,
            description="Earned",
        )
        self.user.spendable_points = 30
        self.user.lifetime_points = 30
        self.user.save(update_fields=["spendable_points", "lifetime_points"])

    def test_refunding_one_of_three_items_reverses_only_its_share(self):
        outcome = settle_refund(self.order, items=[(self.items[0], 1)])

        self.assertEqual(outcome.amount_refunded, Decimal("10.00"))
        self.assertFalse(outcome.fully_refunded)
        # A third of the order came back, so a third of the points go with it.
        self.assertEqual(outcome.points_reversed, 10)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "partially_refunded")
        self.assertEqual(self.order.refunded_total, Decimal("10.00"))

        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 20)

        self.items[0].refresh_from_db()
        self.items[1].refresh_from_db()
        self.assertEqual(self.items[0].refunded_quantity, 1)
        self.assertEqual(self.items[1].refunded_quantity, 0)

    def test_the_earning_row_survives_a_partial_reversal(self):
        settle_refund(self.order, items=[(self.items[0], 1)])
        earned = PointTransaction.objects.get(
            order=self.order, transaction_type=PointTransaction.TYPE_EARNED
        )
        # Cancelling it here would block reversing the remaining two items later.
        self.assertNotEqual(earned.status, PointTransaction.STATUS_CANCELLED)

    def test_successive_partials_add_up_to_a_full_refund(self):
        settle_refund(self.order, items=[(self.items[0], 1)])
        settle_refund(self.order, items=[(self.items[1], 1)])
        final = settle_refund(self.order, items=[(self.items[2], 1)])

        self.assertTrue(final.fully_refunded)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "refunded")
        self.assertEqual(self.order.refunded_total, Decimal("30.00"))

        # All 30 points reversed across the three settlements, never more.
        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 0)
        self.assertEqual(self.user.lifetime_points, 0)

    def test_refund_never_exceeds_the_order_total(self):
        settle_refund(self.order, amount=Decimal("25.00"))
        second = settle_refund(self.order, amount=Decimal("25.00"))

        self.assertEqual(second.amount_refunded, Decimal("5.00"))
        self.order.refresh_from_db()
        self.assertEqual(self.order.refunded_total, Decimal("30.00"))
        self.assertEqual(self.order.status, "refunded")

        third = settle_refund(self.order, amount=Decimal("5.00"))
        self.assertTrue(third.already_settled)
        self.assertEqual(third.amount_refunded, Decimal("0"))

    def test_admin_can_refund_a_single_item_over_the_api(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/admin/orders/{self.order.pk}/",
            {"refund_items": [{"item_id": self.items[0].pk, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "partially_refunded")
        self.assertEqual(Decimal(response.data["refunded_total"]), Decimal("10.00"))

    def test_admin_cannot_refund_more_units_than_were_bought(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/admin/orders/{self.order.pk}/",
            {"refund_items": [{"item_id": self.items[0].pk, "quantity": 5}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.refunded_total, Decimal("0"))

    def test_admin_cannot_refund_an_unpaid_order(self):
        self.order.status = "pending_payment"
        self.order.save(update_fields=["status"])
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/admin/orders/{self.order.pk}/",
            {"refund_items": [{"item_id": self.items[0].pk, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_each_partial_refund_emails_the_customer_its_own_amount(self):
        mail.outbox = []
        settle_refund(self.order, items=[(self.items[0], 1)])
        settle_refund(self.order, items=[(self.items[1], 1)])

        self.assertEqual(len(mail.outbox), 2)

    def test_the_refund_that_completes_the_order_still_emails(self):
        """A partial refund must not silence the notice for the final one.

        The customer has been sent two separate sums and needs telling about
        both; only the settlement amount differs.
        """
        mail.outbox = []
        settle_refund(self.order, items=[(self.items[0], 1)])
        final = settle_refund(
            self.order, items=[(self.items[1], 1), (self.items[2], 1)]
        )

        self.assertTrue(final.fully_refunded)
        self.assertTrue(final.email_sent)
        self.assertEqual(len(mail.outbox), 2)
        bodies = [
            m.body + str(getattr(m, "alternatives", "")) for m in mail.outbox
        ]
        self.assertTrue(any("10.00" in b for b in bodies))
        self.assertTrue(any("20.00" in b for b in bodies))

    def test_a_duplicate_settlement_does_not_email_again(self):
        mail.outbox = []
        settle_refund(self.order, amount=Decimal("30.00"))
        repeat = settle_refund(self.order, amount=Decimal("30.00"))

        self.assertTrue(repeat.already_settled)
        self.assertFalse(repeat.email_sent)
        self.assertEqual(len(mail.outbox), 1)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    KEEPZ_ENABLED=False,
    KEEPZ_INTEGRATOR_ID="9b22e5ba-573b-429c-be00-73c8e22ceeaf",
)
class GatewayPartialRefundTestCase(TestCase):
    """Keepz reporting PARTIALLY_REFUNDED must not nuke the whole order."""

    def setUp(self):
        self.integrator_order_id = uuid.uuid4()
        self.user = User.objects.create_user(email="buyer2@example.com", password="pw")
        self.order = Order.objects.create(
            user=self.user,
            order_number="KOL-GW-PARTIAL",
            status="processing",
            shipping_name="Buyer",
            shipping_line1="Rustaveli 1",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0108",
            shipping_country="GE",
            shipping_email=self.user.email,
            subtotal="30.00",
            total="30.00",
            currency="GEL",
        )
        self.payment = PaymentSession.objects.create(
            purpose=PaymentSession.PURPOSE_CHECKOUT,
            status=PaymentSession.STATUS_SUCCESS,
            user=self.user,
            order=self.order,
            amount="30.00",
            currency="GEL",
            integrator_order_id=self.integrator_order_id,
        )
        PointTransaction.objects.create(
            user=self.user,
            order=self.order,
            transaction_type=PointTransaction.TYPE_EARNED,
            status=PointTransaction.STATUS_AVAILABLE,
            points=30,
            description="Earned",
        )
        self.user.spendable_points = 30
        self.user.lifetime_points = 30
        self.user.save(update_fields=["spendable_points", "lifetime_points"])

    def _status(self, keepz_status, **extra):
        return {
            "integratorOrderId": str(self.integrator_order_id),
            "status": keepz_status,
            "amount": "30.00",
            "currency": "GEL",
            **extra,
        }

    def test_reported_partial_amount_drives_the_reversal(self):
        from apps.orders.payment_service import apply_verified_keepz_status

        apply_verified_keepz_status(
            self.payment.pk, self._status("PARTIALLY_REFUNDED", refundedAmount="10.00")
        )

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "partially_refunded")
        self.assertEqual(self.order.refunded_total, Decimal("10.00"))

        # Only a third of the points, not all 30.
        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 20)

    def test_partial_without_an_amount_is_quarantined_not_guessed(self):
        from apps.orders.payment_service import apply_verified_keepz_status

        apply_verified_keepz_status(self.payment.pk, self._status("PARTIALLY_REFUNDED"))

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentSession.STATUS_NEEDS_REVIEW)

        # Nothing was reversed on a guess.
        self.order.refresh_from_db()
        self.assertEqual(self.order.refunded_total, Decimal("0"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 30)

    def test_full_refund_still_reverses_everything(self):
        from apps.orders.payment_service import apply_verified_keepz_status

        apply_verified_keepz_status(self.payment.pk, self._status("REFUNDED_BY_OPERATOR"))

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "refunded")
        self.assertEqual(self.order.refunded_total, Decimal("30.00"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 0)
