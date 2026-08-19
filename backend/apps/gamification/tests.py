from decimal import Decimal
from uuid import uuid4

from django.test import TestCase
from rest_framework.test import APIClient

from apps.gamification.models import (
    IdempotencyKey,
    LoyaltyTier,
    PointTransaction,
    PointsMarketItem,
    PointsMarketRedemption,
    PointsMarketShippingPaymentSession,
)
from apps.gamification.services import (
    CheckoutDiscountCalculator,
    calculate_earned_points,
    calculate_tier_eligible_subtotal,
    calculate_voucher_discount_for_lines,
    create_pending_purchase_points,
    get_tier_for_points,
    purchase_market_item,
    release_order_points_on_shipment,
    reverse_order_points_for_refund,
)
from apps.orders.models import Cart, DeliveryOption, Order
from apps.promo.models import PromoCode
from apps.products.models import Product
from apps.users.models import User
from apps.vendors.models import Vendor


class LoyaltyServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="loyalty@example.com",
            password="testpass123",
            name="Loyal Customer",
        )

    def _order(self, total=Decimal("200.00")):
        return Order.objects.create(
            user=self.user,
            shipping_name="Loyal Customer",
            shipping_line1="1 Test Street",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0101",
            shipping_country="GE",
            shipping_email=self.user.email,
            subtotal=total,
            total=total,
            currency="GEL",
        )

    def test_calculate_earned_points_uses_half_up_rounding(self):
        self.assertEqual(calculate_earned_points(Decimal("25.50")), 13)
        self.assertEqual(calculate_earned_points(Decimal("25.00")), 13)
        self.assertEqual(calculate_earned_points(Decimal("24.98")), 12)

    def test_checkout_creates_pending_points_and_lifetime_progress(self):
        order = self._order(Decimal("200.00"))

        tx = create_pending_purchase_points(order)
        self.user.refresh_from_db()

        self.assertEqual(tx.points, 100)
        self.assertEqual(tx.status, PointTransaction.STATUS_PENDING)
        self.assertIsNone(tx.available_at)
        self.assertEqual(tx.metadata["unlock_condition"], "order_shipped")
        self.assertEqual(self.user.lifetime_points, 100)
        self.assertEqual(self.user.spendable_points, 0)

    def test_shipping_releases_pending_points_to_spendable_balance(self):
        order = self._order(Decimal("200.00"))
        tx = create_pending_purchase_points(order)

        released = release_order_points_on_shipment(order)
        self.user.refresh_from_db()
        tx.refresh_from_db()

        self.assertEqual(released, 100)
        self.assertEqual(tx.status, PointTransaction.STATUS_AVAILABLE)
        self.assertIsNotNone(tx.available_at)
        self.assertEqual(self.user.spendable_points, 100)
        self.assertEqual(release_order_points_on_shipment(order), 0)
        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 100)

    def test_checkout_points_use_final_paid_total_without_currency_conversion(self):
        gel_order = self._order(Decimal("25.50"))
        gel_order.currency = "GEL"
        gel_order.save(update_fields=["currency"])
        usd_order = self._order(Decimal("25.50"))
        usd_order.currency = "USD"
        usd_order.save(update_fields=["currency"])

        gel_tx = create_pending_purchase_points(gel_order)
        usd_tx = create_pending_purchase_points(usd_order)

        self.assertEqual(gel_tx.points, 13)
        self.assertEqual(usd_tx.points, 13)

    def test_market_purchase_deducts_points_decrements_stock_and_locks_at_zero(self):
        self.user.spendable_points = 300
        self.user.save(update_fields=["spendable_points"])
        item = PointsMarketItem.objects.create(
            name="Voucher",
            point_cost=300,
            stock_quantity=1,
            item_type=PointsMarketItem.TYPE_DIGITAL,
        )

        tx = purchase_market_item(self.user, item.id)
        self.user.refresh_from_db()
        item.refresh_from_db()

        self.assertEqual(self.user.spendable_points, 0)
        self.assertEqual(item.stock_quantity, 0)
        self.assertFalse(item.is_active)
        self.assertIsNotNone(item.locked_at)
        self.assertEqual(tx.status, PointTransaction.STATUS_SPENT)
        self.assertEqual(tx.points, -300)

    def test_market_purchase_can_immediately_downgrade_tier(self):
        self.user.spendable_points = 360
        self.user.save(update_fields=["spendable_points"])
        item = PointsMarketItem.objects.create(
            name="Small reward",
            point_cost=20,
            stock_quantity=1,
            item_type=PointsMarketItem.TYPE_DIGITAL,
        )

        self.assertEqual(get_tier_for_points(self.user.spendable_points).key, LoyaltyTier.CHUNIN)
        purchase_market_item(self.user, item.id)
        self.user.refresh_from_db()

        self.assertEqual(self.user.spendable_points, 340)
        self.assertEqual(get_tier_for_points(self.user.spendable_points).key, LoyaltyTier.GENIN)

    def test_market_purchase_rolls_back_when_balance_is_too_low(self):
        item = PointsMarketItem.objects.create(
            name="Voucher",
            point_cost=300,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_DIGITAL,
        )

        with self.assertRaises(ValueError):
            purchase_market_item(self.user, item.id)

        self.user.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 0)
        self.assertEqual(item.stock_quantity, 2)
        self.assertEqual(PointTransaction.objects.count(), 0)

    def test_points_market_api_requires_strict_payload_and_idempotency_key(self):
        client = APIClient()
        client.force_authenticate(self.user)
        key = str(uuid4())

        response = client.post(
            "/api/gamification/market/purchase/",
            {"item_id": 1, "point_cost": 1},
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )
        self.assertEqual(response.status_code, 400)

        response = client.post(
            "/api/gamification/market/purchase/",
            {"item_id": 1},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_points_market_api_replays_same_idempotency_key_without_double_spending(self):
        self.user.spendable_points = 500
        self.user.save(update_fields=["spendable_points"])
        item = PointsMarketItem.objects.create(
            name="Voucher",
            point_cost=200,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_DIGITAL,
            voucher_discount_value=Decimal("5.00"),
        )
        client = APIClient()
        client.force_authenticate(self.user)
        key = str(uuid4())
        payload = {"item_id": item.id}

        first = client.post("/api/gamification/market/purchase/", payload, format="json", HTTP_IDEMPOTENCY_KEY=key)
        second = client.post("/api/gamification/market/purchase/", payload, format="json", HTTP_IDEMPOTENCY_KEY=key)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["transaction"]["id"], second.data["transaction"]["id"])
        self.user.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 300)
        self.assertEqual(item.stock_quantity, 1)
        self.assertEqual(PointTransaction.objects.filter(transaction_type=PointTransaction.TYPE_SPENT).count(), 1)
        self.assertEqual(IdempotencyKey.objects.filter(status=IdempotencyKey.STATUS_SUCCEEDED).count(), 1)

    def test_digital_market_purchase_creates_one_use_promo_code(self):
        from apps.promo.models import PromoCode, UserPromoGrant

        self.user.spendable_points = 500
        self.user.save(update_fields=["spendable_points"])
        item = PointsMarketItem.objects.create(
            name="Five Percent Voucher",
            point_cost=150,
            stock_quantity=1,
            item_type=PointsMarketItem.TYPE_DIGITAL,
            voucher_discount_type=PointsMarketItem.DISCOUNT_PERCENT,
            voucher_discount_value=Decimal("5.00"),
        )
        client = APIClient()
        client.force_authenticate(self.user)

        response = client.post(
            "/api/gamification/market/purchase/",
            {"item_id": item.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid4()),
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["voucher"]["code"].startswith("PTS"))
        promo = PromoCode.objects.get(code=response.data["voucher"]["code"])
        self.assertEqual(promo.discount_type, "percent")
        self.assertEqual(promo.discount_value, Decimal("5.00"))
        self.assertEqual(promo.max_uses, 1)
        self.assertEqual(promo.max_uses_per_user, 1)
        self.assertTrue(UserPromoGrant.objects.filter(user=self.user, promo=promo).exists())

        Cart.objects.create(user=self.user)
        apply_response = client.post(
            "/api/orders/cart/promo/",
            {"code": response.data["voucher"]["code"].upper()},
            format="json",
        )
        self.assertEqual(apply_response.status_code, 200)
        self.assertEqual(apply_response.data["promo_code_str"], promo.code)

    def test_physical_rewards_cannot_use_digital_purchase_endpoint(self):
        self.user.spendable_points = 500
        self.user.save(update_fields=["spendable_points"])
        item = PointsMarketItem.objects.create(
            name="Collector Pack",
            point_cost=200,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        client = APIClient()
        client.force_authenticate(self.user)

        response = client.post(
            "/api/gamification/market/purchase/",
            {"item_id": item.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid4()),
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 500)
        self.assertEqual(item.stock_quantity, 2)

    def test_paid_shipping_physical_redemption_does_not_deduct_points_or_stock(self):
        self.user.spendable_points = 500
        self.user.save(update_fields=["spendable_points"])
        item = PointsMarketItem.objects.create(
            name="Collector Pack",
            point_cost=200,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        delivery = DeliveryOption.objects.create(
            slug="paid-test",
            label="Courier",
            price_gel=Decimal("9.00"),
            price_usd=Decimal("5.00"),
            is_active=True,
        )
        client = APIClient()
        client.force_authenticate(self.user)

        response = client.post(
            "/api/gamification/market/redeem-physical/",
            {
                "item_id": item.id,
                "shipping_slug": f"delivery-{delivery.id}",
                "country": "GE",
                "address": {
                    "line1": "1 Test Street",
                    "city": "Tbilisi",
                    "state": "Tbilisi",
                    "zip_code": "0101",
                    "country": "GE",
                },
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid4()),
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["payment_required"])
        self.user.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 500)
        self.assertEqual(item.stock_quantity, 2)
        self.assertEqual(PointsMarketRedemption.objects.count(), 0)
        session = PointsMarketShippingPaymentSession.objects.get()
        self.assertEqual(session.status, PointsMarketShippingPaymentSession.STATUS_PENDING)
        self.assertEqual(session.shipping_price, Decimal("9.00"))
        self.assertEqual(PointTransaction.objects.filter(transaction_type=PointTransaction.TYPE_SPENT).count(), 0)

        complete = client.post(f"/api/gamification/market/shipping-payment/{session.token}/complete/", {}, format="json")
        self.assertEqual(complete.status_code, 200)
        self.user.refresh_from_db()
        item.refresh_from_db()
        session.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 300)
        self.assertEqual(item.stock_quantity, 1)
        self.assertEqual(session.status, PointsMarketShippingPaymentSession.STATUS_PAID)
        self.assertEqual(PointsMarketRedemption.objects.count(), 1)
        self.assertEqual(PointTransaction.objects.filter(transaction_type=PointTransaction.TYPE_SPENT).count(), 1)

    def test_free_pickup_physical_redemption_deducts_points_stock_and_creates_fulfillment(self):
        self.user.spendable_points = 500
        self.user.save(update_fields=["spendable_points"])
        item = PointsMarketItem.objects.create(
            name="Collector Pack",
            point_cost=200,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        client = APIClient()
        client.force_authenticate(self.user)

        response = client.post(
            "/api/gamification/market/redeem-physical/",
            {
                "item_id": item.id,
                "shipping_slug": "pickup",
                "country": "GE",
                "address": {
                    "line1": "1 Test Street",
                    "city": "Tbilisi",
                    "state": "Tbilisi",
                    "zip_code": "0101",
                    "country": "GE",
                },
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid4()),
        )

        self.assertEqual(response.status_code, 201)
        self.user.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 300)
        self.assertEqual(item.stock_quantity, 1)
        redemption = PointsMarketRedemption.objects.get()
        self.assertEqual(redemption.status, PointsMarketRedemption.STATUS_PENDING)
        self.assertEqual(redemption.shipping_type, "self-pickup")
        self.assertEqual(redemption.point_cost, 200)

    def test_public_points_market_hides_inactive_and_sold_out_items(self):
        visible = PointsMarketItem.objects.create(
            name="Visible reward",
            point_cost=50,
            stock_quantity=1,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        PointsMarketItem.objects.create(
            name="Inactive reward",
            point_cost=50,
            stock_quantity=1,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
            is_active=False,
        )
        PointsMarketItem.objects.create(
            name="Sold reward",
            point_cost=50,
            stock_quantity=0,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        client = APIClient()
        client.force_authenticate(self.user)

        response = client.get("/api/gamification/market/")

        self.assertEqual(response.status_code, 200)
        payload = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        ids = [item["id"] for item in payload]
        self.assertEqual(ids, [visible.id])

    def test_refund_reversal_cancels_original_and_allows_negative_spendable_balance(self):
        order = self._order(Decimal("100.00"))
        original = create_pending_purchase_points(order)
        original.status = PointTransaction.STATUS_AVAILABLE
        original.save(update_fields=["status"])
        self.user.spendable_points = 20
        self.user.lifetime_points = 50
        self.user.save(update_fields=["spendable_points", "lifetime_points"])

        reversal = reverse_order_points_for_refund(order, reason="Refunded by admin")
        self.user.refresh_from_db()
        original.refresh_from_db()

        self.assertEqual(original.status, PointTransaction.STATUS_CANCELLED)
        self.assertEqual(reversal.transaction_type, PointTransaction.TYPE_REFUND_REVERSAL)
        self.assertEqual(reversal.points, -50)
        self.assertEqual(self.user.spendable_points, -30)
        self.assertEqual(self.user.lifetime_points, 0)

        second = reverse_order_points_for_refund(order, reason="Duplicate refund webhook")
        self.assertIsNone(second)

    def test_refund_reversal_can_immediately_downgrade_tier(self):
        order = self._order(Decimal("40.00"))
        original = create_pending_purchase_points(order)
        self.user.spendable_points = 360
        self.user.lifetime_points = 360
        self.user.save(update_fields=["spendable_points", "lifetime_points"])

        self.assertEqual(get_tier_for_points(self.user.spendable_points).key, LoyaltyTier.CHUNIN)
        reverse_order_points_for_refund(order, reason="Refunded by admin")
        self.user.refresh_from_db()
        original.refresh_from_db()

        self.assertEqual(original.status, PointTransaction.STATUS_CANCELLED)
        self.assertEqual(self.user.spendable_points, 340)
        self.assertEqual(get_tier_for_points(self.user.spendable_points).key, LoyaltyTier.GENIN)

    def test_admin_cancel_does_not_reverse_points_but_refund_does(self):
        admin = User.objects.create_user(
            email="admin@example.com",
            password="testpass123",
            name="Admin",
            is_staff=True,
        )
        order = self._order(Decimal("100.00"))
        original = create_pending_purchase_points(order)
        self.user.spendable_points = 50
        self.user.lifetime_points = 50
        self.user.save(update_fields=["spendable_points", "lifetime_points"])

        client = APIClient()
        client.force_authenticate(admin)
        cancel_response = client.patch(
            f"/api/admin/orders/{order.id}/",
            {"status": "cancelled", "note": "Cancelled without refund"},
            format="json",
        )
        self.assertEqual(cancel_response.status_code, 200)
        self.user.refresh_from_db()
        original.refresh_from_db()
        self.assertEqual(original.status, PointTransaction.STATUS_PENDING)
        self.assertEqual(self.user.spendable_points, 50)
        self.assertEqual(self.user.lifetime_points, 50)

        refund_response = client.patch(
            f"/api/admin/orders/{order.id}/",
            {"status": "refunded", "note": "Refund completed"},
            format="json",
        )
        self.assertEqual(refund_response.status_code, 200)
        self.user.refresh_from_db()
        original.refresh_from_db()
        self.assertEqual(original.status, PointTransaction.STATUS_CANCELLED)
        self.assertEqual(self.user.spendable_points, 0)
        self.assertEqual(self.user.lifetime_points, 0)

    def test_admin_users_list_includes_points_pending_and_tier(self):
        admin = User.objects.create_user(
            email="admin-list@example.com",
            password="testpass123",
            name="Admin",
            is_staff=True,
        )
        self.user.spendable_points = 360
        self.user.save(update_fields=["spendable_points"])
        order = self._order(Decimal("100.00"))
        create_pending_purchase_points(order)

        client = APIClient()
        client.force_authenticate(admin)
        response = client.get("/api/admin/users/")

        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data if item["id"] == str(self.user.id))
        self.assertEqual(row["spendable_points"], 360)
        self.assertEqual(row["pending_points"], 50)
        self.assertEqual(row["tier_name"], "Chunin")

    def test_admin_points_adjustment_is_ledgered_and_validated(self):
        from apps.admin_api.models import AuditLog

        admin = User.objects.create_user(
            email="admin-points@example.com",
            password="testpass123",
            name="Admin",
            is_staff=True,
        )
        self.user.spendable_points = 100
        self.user.save(update_fields=["spendable_points"])
        client = APIClient()
        client.force_authenticate(admin)

        response = client.post(
            f"/api/admin/users/{self.user.id}/points-adjustment/",
            {"amount": 25, "reason": "Customer service courtesy credit"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 125)
        tx = PointTransaction.objects.get(
            user=self.user,
            transaction_type=PointTransaction.TYPE_ADJUSTMENT,
        )
        self.assertEqual(tx.points, 25)
        self.assertEqual(tx.metadata["balance_before"], 100)
        self.assertEqual(tx.metadata["balance_after"], 125)
        self.assertTrue(AuditLog.objects.filter(action="points_adjustment", target_id=str(self.user.id)).exists())

        blocked = client.post(
            f"/api/admin/users/{self.user.id}/points-adjustment/",
            {"amount": -999, "reason": "Invalid excessive reduction"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.spendable_points, 125)

    def test_checkout_discount_combines_tier_sale_bonus_and_non_sale_voucher(self):
        self.user.spendable_points = 1000
        self.user.save(update_fields=["spendable_points"])
        promo = PromoCode.objects.create(
            code="SAVE10",
            discount_type="percent",
            discount_value=Decimal("10.00"),
        )
        sale_product = Product.objects.create(title="Sale panel", base_price=Decimal("100.00"), is_sale=True)
        regular_product = Product.objects.create(title="Regular figure", base_price=Decimal("80.00"))
        lines = [
            (sale_product, Decimal("100.00"), True),
            (regular_product, Decimal("80.00"), False),
        ]
        sale_subtotal, tier = calculate_tier_eligible_subtotal(self.user, lines)
        voucher_discount = calculate_voucher_discount_for_lines(promo, lines)

        decision = CheckoutDiscountCalculator(
            self.user,
            Decimal("180.00"),
            promo=promo,
            voucher_discount=voucher_discount,
            tier_eligible_subtotal=sale_subtotal,
            tier_info=tier,
        ).evaluate()

        self.assertEqual(decision.source, "tier_voucher")
        self.assertEqual(decision.tier_discount, Decimal("10.00"))
        self.assertEqual(decision.voucher_discount, Decimal("8.00"))
        self.assertEqual(decision.discount, Decimal("18.00"))

    def test_registration_has_no_default_current_balance_discount(self):
        decision = CheckoutDiscountCalculator(
            self.user,
            Decimal("100.00"),
            tier_eligible_subtotal=Decimal("100.00"),
        ).evaluate()

        self.assertEqual(decision.source, "none")
        self.assertEqual(decision.tier_percent, Decimal("0.00"))
        self.assertEqual(decision.discount, Decimal("0"))

    def test_tier_ranges_are_zero_to_350_350_to_1000_and_1000_plus(self):
        self.assertEqual(get_tier_for_points(0).key, LoyaltyTier.GENIN)
        self.assertEqual(get_tier_for_points(0).discount_percent, Decimal("0"))
        self.assertEqual(get_tier_for_points(349).key, LoyaltyTier.GENIN)
        self.assertEqual(get_tier_for_points(350).key, LoyaltyTier.CHUNIN)
        self.assertEqual(get_tier_for_points(350).discount_percent, Decimal("5"))
        self.assertEqual(get_tier_for_points(999).key, LoyaltyTier.CHUNIN)
        self.assertEqual(get_tier_for_points(1000).key, LoyaltyTier.JONIN)
        self.assertEqual(get_tier_for_points(1000).discount_percent, Decimal("10"))

    def test_tier_discount_applies_only_to_sale_products(self):
        self.user.spendable_points = 350
        self.user.save(update_fields=["spendable_points"])
        eligible = Product.objects.create(title="Sale panel", base_price=Decimal("100.00"), is_sale=True)
        blocked = Product.objects.create(title="Full price figure", base_price=Decimal("80.00"))

        eligible_subtotal, tier = calculate_tier_eligible_subtotal(
            self.user,
            [(eligible, Decimal("100.00"), True), (blocked, Decimal("80.00"), False)],
        )
        decision = CheckoutDiscountCalculator(
            self.user,
            Decimal("180.00"),
            tier_eligible_subtotal=eligible_subtotal,
            tier_info=tier,
        ).evaluate()

        self.assertEqual(eligible_subtotal, Decimal("100.00"))
        self.assertEqual(decision.source, "tier")
        self.assertEqual(decision.discount, Decimal("5.00"))


class VendorLoyaltyAdminAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.vendor_user = User.objects.create_user(
            email="vendor-loyalty@example.com",
            password="testpass123",
            name="Vendor Loyalty",
        )
        self.other_vendor_user = User.objects.create_user(
            email="other-vendor@example.com",
            password="testpass123",
            name="Other Vendor",
        )
        self.customer = User.objects.create_user(
            email="customer-loyalty@example.com",
            password="testpass123",
            name="Customer Loyalty",
        )
        self.vendor = Vendor.objects.create(user=self.vendor_user, name="MangaMoon", slug="mangamoon")
        self.other_vendor = Vendor.objects.create(user=self.other_vendor_user, name="Sculpi", slug="sculpi")

    def test_vendor_points_market_is_scoped_to_own_physical_rewards(self):
        own_item = PointsMarketItem.objects.create(
            name="Own Reward",
            vendor=self.vendor,
            point_cost=25,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        PointsMarketItem.objects.create(
            name="Other Reward",
            vendor=self.other_vendor,
            point_cost=25,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        PointsMarketItem.objects.create(
            name="Global Voucher",
            point_cost=25,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_DIGITAL,
            voucher_discount_value=5,
        )

        self.client.force_authenticate(self.vendor_user)
        response = self.client.get("/api/admin/gamification/market/")

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in response.data}
        self.assertEqual(ids, {own_item.id})

    def test_vendor_cannot_create_digital_voucher_reward(self):
        self.client.force_authenticate(self.vendor_user)
        response = self.client.post(
            "/api/admin/gamification/market/",
            {
                "name": "Vendor Voucher",
                "description": "",
                "point_cost": 50,
                "stock_quantity": 10,
                "item_type": PointsMarketItem.TYPE_DIGITAL,
                "voucher_discount_type": PointsMarketItem.DISCOUNT_PERCENT,
                "voucher_discount_value": "5.00",
                "voucher_min_order_value": "0.00",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_vendor_redemptions_and_ledger_are_scoped_to_own_rewards(self):
        own_item = PointsMarketItem.objects.create(
            name="Own Reward",
            vendor=self.vendor,
            point_cost=25,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        other_item = PointsMarketItem.objects.create(
            name="Other Reward",
            vendor=self.other_vendor,
            point_cost=25,
            stock_quantity=2,
            item_type=PointsMarketItem.TYPE_PHYSICAL,
        )
        own_tx = PointTransaction.objects.create(
            user=self.customer,
            market_item=own_item,
            transaction_type=PointTransaction.TYPE_SPENT,
            status=PointTransaction.STATUS_SPENT,
            points=-25,
            description="Own reward redemption",
        )
        other_tx = PointTransaction.objects.create(
            user=self.customer,
            market_item=other_item,
            transaction_type=PointTransaction.TYPE_SPENT,
            status=PointTransaction.STATUS_SPENT,
            points=-25,
            description="Other reward redemption",
        )
        own_redemption = PointsMarketRedemption.objects.create(
            user=self.customer,
            market_item=own_item,
            transaction=own_tx,
            item_name=own_item.name,
            point_cost=own_item.point_cost,
            shipping_name="Customer Loyalty",
            shipping_line1="1 Test Street",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0101",
            shipping_country="GE",
            shipping_email=self.customer.email,
            shipping_type="pickup",
            shipping_label="I will take it myself",
        )
        PointsMarketRedemption.objects.create(
            user=self.customer,
            market_item=other_item,
            transaction=other_tx,
            item_name=other_item.name,
            point_cost=other_item.point_cost,
            shipping_name="Customer Loyalty",
            shipping_line1="1 Test Street",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0101",
            shipping_country="GE",
            shipping_email=self.customer.email,
            shipping_type="pickup",
            shipping_label="I will take it myself",
        )

        self.client.force_authenticate(self.vendor_user)
        redemptions_response = self.client.get("/api/admin/gamification/redemptions/")
        transactions_response = self.client.get("/api/admin/gamification/transactions/")

        self.assertEqual(redemptions_response.status_code, 200)
        self.assertEqual(transactions_response.status_code, 200)
        self.assertEqual([row["id"] for row in redemptions_response.data["results"]], [own_redemption.id])
        self.assertEqual([row["id"] for row in transactions_response.data["results"]], [own_tx.id])
