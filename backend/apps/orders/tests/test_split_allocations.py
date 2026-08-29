from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.gamification.services import calculate_voucher_discount_for_lines
from apps.orders.allocations import allocate_amount, allocate_checkout_discounts
from apps.orders.keepz import KeepzConfigurationError, _split_details_for_order
from apps.orders.models import Cart, CartItem, Order, OrderItem, OrderShipment
from apps.products.models import Category, Product, SizeVariant
from apps.promo.models import PromoCode
from apps.users.models import User
from apps.vendors.models import Vendor


@override_settings(
    KEEPZ_RECEIVER_ID="platform-ge",
    KEEPZ_FOREIGN_RECEIVER_ID="platform-usd",
    KEEPZ_RECEIVER_TYPE="BRANCH",
    KEEPZ_VENDOR_RECEIVER_TYPE="BRANCH",
)
class CheckoutAllocationTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(email="buyer-split@example.com", password="test")
        vendor_one_user = User.objects.create_user(email="vendor-one@example.com", password="test")
        vendor_two_user = User.objects.create_user(email="vendor-two@example.com", password="test")
        self.vendor_one = Vendor.objects.create(
            user=vendor_one_user, name="Vendor One", slug="vendor-one", merchant_id="receiver-one"
        )
        self.vendor_two = Vendor.objects.create(
            user=vendor_two_user, name="Vendor Two", slug="vendor-two", merchant_id="receiver-two"
        )
        self.category_one = Category.objects.create(name="Category One", slug="category-one")
        self.category_two = Category.objects.create(name="Category Two", slug="category-two")
        self.product_one = Product.objects.create(
            title="Product One", base_price="100.00", vendor=self.vendor_one, category=self.category_one
        )
        self.product_two = Product.objects.create(
            title="Product Two", base_price="100.00", vendor=self.vendor_two, category=self.category_two
        )
        self.product_three = Product.objects.create(
            title="Product Three", base_price="100.00", vendor=self.vendor_two
        )
        self.product_three.categories.add(self.category_one)

    @override_settings(KEEPZ_ENABLED=False)
    def test_checkout_persists_mixed_sale_tier_and_category_voucher_allocations(self):
        self.buyer.spendable_points = 1000
        self.buyer.save(update_fields=["spendable_points"])
        sale_variant = SizeVariant.objects.create(
            product=self.product_one, label="Sale", price_usd="50.00", price_gel="100.00",
            sale_price_gel="90.00",
        )
        regular_variant = SizeVariant.objects.create(
            product=self.product_two, label="Regular", price_usd="50.00", price_gel="100.00",
        )
        promo = PromoCode.objects.create(
            code="CHECKOUTCATEGORY", discount_type="percent", discount_value=Decimal("20")
        )
        promo.categories.add(self.category_two)
        cart = Cart.objects.create(user=self.buyer, promo_code=promo)
        CartItem.objects.create(
            cart=cart, size_variant=sale_variant, quantity=1, unit_price="90.00", currency="GEL"
        )
        CartItem.objects.create(
            cart=cart, size_variant=regular_variant, quantity=1, unit_price="100.00", currency="GEL"
        )
        client = APIClient()
        client.force_authenticate(self.buyer)

        cart_response = client.get("/api/orders/cart/")
        self.assertEqual(cart_response.status_code, 200)
        self.assertEqual(cart_response.data["discount"], "29.00")
        self.assertEqual(cart_response.data["tier_discount"], "9.00")
        self.assertEqual(cart_response.data["voucher_discount"], "20.00")

        response = client.post(
            "/api/orders/checkout/",
            {
                "shipping_name": "Buyer Test",
                "shipping_line1": "Rustaveli 1",
                "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi",
                "shipping_zip": "0108",
                "shipping_country": "GE",
                "shipping_email": self.buyer.email,
                "shipping_phone": "+995555000000",
                "currency": "GEL",
                "delivery_type": "standard",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(order_number=response.data["order_number"])
        items = {item.vendor_id: item for item in order.items.all()}
        self.assertEqual(order.subtotal, Decimal("190.00"))
        self.assertEqual(order.discount, Decimal("29.00"))
        self.assertEqual(order.total, Decimal("161.00"))
        self.assertEqual(items[self.vendor_one.id].tier_discount, Decimal("9.00"))
        self.assertEqual(items[self.vendor_one.id].voucher_discount, Decimal("0.00"))
        self.assertEqual(items[self.vendor_two.id].tier_discount, Decimal("0.00"))
        self.assertEqual(items[self.vendor_two.id].voucher_discount, Decimal("20.00"))
        by_receiver = {
            row["receiverIdentifier"]: Decimal(str(row["amount"]))
            for row in _split_details_for_order(order)
        }
        self.assertEqual(by_receiver, {"receiver-one": Decimal("81.0"), "receiver-two": Decimal("80.0")})

    def lines(self, *sale_flags):
        products = [self.product_one, self.product_two, self.product_three]
        return [
            {
                "product": product,
                "product_subtotal": Decimal("100.00"),
                "is_sale": sale_flags[index] if index < len(sale_flags) else False,
            }
            for index, product in enumerate(products)
        ]

    def test_cent_allocator_is_exact_and_deterministic(self):
        allocations = allocate_amount(Decimal("0.01"), [Decimal("1"), Decimal("1"), Decimal("1")])

        self.assertEqual(allocations, [Decimal("0.01"), Decimal("0.00"), Decimal("0.00")])
        self.assertEqual(sum(allocations), Decimal("0.01"))

    def test_global_percent_voucher_applies_to_every_non_sale_product(self):
        promo = PromoCode.objects.create(code="GLOBAL10", discount_type="percent", discount_value=Decimal("10"))
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in self.lines(False, True, False)]
        voucher_discount = calculate_voucher_discount_for_lines(promo, raw_lines)
        allocations = allocate_checkout_discounts(self.lines(False, True, False), promo, 0, voucher_discount)

        self.assertEqual(voucher_discount, Decimal("20.00"))
        self.assertEqual(
            [row["voucher_discount"] for row in allocations],
            [Decimal("10.00"), Decimal("0.00"), Decimal("10.00")],
        )

    def test_fixed_voucher_is_split_only_across_non_sale_products(self):
        promo = PromoCode.objects.create(code="FIXED30", discount_type="fixed", discount_value=Decimal("30"))
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in self.lines(False, True, False)]
        voucher_discount = calculate_voucher_discount_for_lines(promo, raw_lines)
        allocations = allocate_checkout_discounts(self.lines(False, True, False), promo, 0, voucher_discount)

        self.assertEqual(voucher_discount, Decimal("30.00"))
        self.assertEqual(
            [row["voucher_discount"] for row in allocations],
            [Decimal("15.00"), Decimal("0.00"), Decimal("15.00")],
        )

    def test_product_scoped_voucher_only_reduces_that_product(self):
        promo = PromoCode.objects.create(code="ONEPRODUCT", discount_type="percent", discount_value=Decimal("25"))
        promo.products.add(self.product_two)
        lines = self.lines(False, False, False)
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in lines]
        voucher_discount = calculate_voucher_discount_for_lines(promo, raw_lines)
        allocations = allocate_checkout_discounts(lines, promo, 0, voucher_discount)

        self.assertEqual(voucher_discount, Decimal("25.00"))
        self.assertEqual(
            [row["voucher_discount"] for row in allocations],
            [Decimal("0.00"), Decimal("25.00"), Decimal("0.00")],
        )

    def test_category_scoped_voucher_covers_primary_and_secondary_categories(self):
        promo = PromoCode.objects.create(code="CATEGORY", discount_type="percent", discount_value=Decimal("10"))
        promo.categories.add(self.category_one)
        lines = self.lines(False, False, False)
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in lines]
        voucher_discount = calculate_voucher_discount_for_lines(promo, raw_lines)
        allocations = allocate_checkout_discounts(lines, promo, 0, voucher_discount)

        self.assertEqual(voucher_discount, Decimal("20.00"))
        self.assertEqual(
            [row["voucher_discount"] for row in allocations],
            [Decimal("10.00"), Decimal("0.00"), Decimal("10.00")],
        )

    def test_product_and_category_scopes_use_or_semantics(self):
        promo = PromoCode.objects.create(code="MIXEDSCOPE", discount_type="percent", discount_value=Decimal("10"))
        promo.products.add(self.product_two)
        promo.categories.add(self.category_one)
        lines = self.lines(False, False, False)
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in lines]
        voucher_discount = calculate_voucher_discount_for_lines(promo, raw_lines)
        allocations = allocate_checkout_discounts(lines, promo, 0, voucher_discount)

        self.assertEqual(voucher_discount, Decimal("30.00"))
        self.assertEqual(
            [row["voucher_discount"] for row in allocations],
            [Decimal("10.00"), Decimal("10.00"), Decimal("10.00")],
        )

    def test_owned_voucher_still_respects_product_scope(self):
        promo = PromoCode.objects.create(
            code="CREATORSCOPED", owner=self.buyer, discount_type="percent", discount_value=Decimal("10")
        )
        promo.products.add(self.product_one)
        lines = self.lines(False, False, False)
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in lines]

        self.assertEqual(calculate_voucher_discount_for_lines(promo, raw_lines), Decimal("10.00"))

    def test_sale_product_uses_tier_discount_and_never_voucher_discount(self):
        promo = PromoCode.objects.create(code="SALEEXCLUDED", discount_type="percent", discount_value=Decimal("10"))
        promo.products.add(self.product_one)
        lines = self.lines(True, False, False)
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in lines]
        voucher_discount = calculate_voucher_discount_for_lines(promo, raw_lines)
        allocations = allocate_checkout_discounts(lines, promo, Decimal("10.00"), voucher_discount)

        self.assertEqual(voucher_discount, Decimal("0.00"))
        self.assertEqual(allocations[0]["tier_discount"], Decimal("10.00"))
        self.assertEqual(allocations[0]["voucher_discount"], Decimal("0.00"))

    def test_all_sale_products_share_only_the_tier_discount_by_line_value(self):
        lines = self.lines(True, True, True)
        lines[0]["product_subtotal"] = Decimal("50.00")
        allocations = allocate_checkout_discounts(lines, None, Decimal("25.00"), Decimal("0.00"))

        self.assertEqual(
            [row["tier_discount"] for row in allocations],
            [Decimal("5.00"), Decimal("10.00"), Decimal("10.00")],
        )
        self.assertTrue(all(row["voucher_discount"] == 0 for row in allocations))

    def test_fixed_voucher_is_capped_to_eligible_product_value(self):
        promo = PromoCode.objects.create(
            code="FIXEDCAP", discount_type="fixed", discount_value=Decimal("500.00")
        )
        promo.products.add(self.product_two)
        lines = self.lines(False, False, False)
        raw_lines = [(line["product"], line["product_subtotal"], line["is_sale"]) for line in lines]
        voucher_discount = calculate_voucher_discount_for_lines(promo, raw_lines)
        allocations = allocate_checkout_discounts(lines, promo, 0, voucher_discount)

        self.assertEqual(voucher_discount, Decimal("100.00"))
        self.assertEqual(
            [row["voucher_discount"] for row in allocations],
            [Decimal("0.00"), Decimal("100.00"), Decimal("0.00")],
        )

    def make_order(self, **overrides):
        values = {
            "user": self.buyer,
            "order_number": "KOL-SPLIT-TEST",
            "shipping_name": "Buyer",
            "shipping_line1": "Street 1",
            "shipping_city": "Tbilisi",
            "shipping_state": "Tbilisi",
            "shipping_zip": "0108",
            "shipping_country": "GE",
            "shipping_email": self.buyer.email,
            "subtotal": Decimal("200.00"),
            "discount": Decimal("30.00"),
            "delivery_price": Decimal("7.00"),
            "gift_wrap_total": Decimal("5.00"),
            "processing_fee_total": Decimal("2.00"),
            "currency": "GEL",
            "total": Decimal("184.00"),
        }
        values.update(overrides)
        return Order.objects.create(**values)

    def test_split_uses_exact_vendor_discounts_wrap_processing_and_shipping(self):
        order = self.make_order()
        OrderItem.objects.create(
            order=order, vendor=self.vendor_one, product_title="One", size_label="", finish_label="",
            frame_label="", price="100.00", quantity=1, gift_wrap=True, gift_wrap_price="5.00",
            processing_fee="2.00", tier_discount="10.00", voucher_discount="0.00",
        )
        OrderItem.objects.create(
            order=order, vendor=self.vendor_two, product_title="Two", size_label="", finish_label="",
            frame_label="", price="100.00", quantity=1, tier_discount="0.00", voucher_discount="20.00",
        )
        OrderShipment.objects.create(
            order=order, vendor=self.vendor_two, delivery_type="courier", delivery_label="Courier",
            delivery_price="7.00",
        )

        details = _split_details_for_order(order)
        by_receiver = {row["receiverIdentifier"]: Decimal(str(row["amount"])) for row in details}

        self.assertEqual(by_receiver, {"receiver-one": Decimal("97.0"), "receiver-two": Decimal("87.0")})
        self.assertEqual(sum(by_receiver.values()), order.total)

    def test_usd_platform_items_use_foreign_market_receiver(self):
        order = self.make_order(
            order_number="KOL-USD-PLATFORM", shipping_country="US", currency="USD",
            subtotal="50.00", discount="0.00", delivery_price="0.00", gift_wrap_total="0.00",
            processing_fee_total="0.00", total="50.00",
        )
        OrderItem.objects.create(
            order=order, product_title="Platform item", size_label="", finish_label="", frame_label="",
            price="50.00", quantity=1,
        )

        details = _split_details_for_order(order)

        self.assertEqual(details[0]["receiverIdentifier"], "platform-usd")
        self.assertEqual(details[0]["amount"], 50.0)

    def test_complete_snapshots_fail_closed_on_material_total_mismatch(self):
        order = self.make_order(
            order_number="KOL-BAD-SPLIT", subtotal="100.00", discount="0.00", delivery_price="0.00",
            gift_wrap_total="0.00", processing_fee_total="0.00", total="95.00",
        )
        OrderItem.objects.create(
            order=order, vendor=self.vendor_one, product_title="One", size_label="", finish_label="",
            frame_label="", price="100.00", quantity=1,
        )

        with self.assertRaises(KeepzConfigurationError):
            _split_details_for_order(order)
