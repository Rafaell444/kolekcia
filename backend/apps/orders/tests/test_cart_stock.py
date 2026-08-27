from unittest.mock import patch
from datetime import timedelta
from types import SimpleNamespace

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from django.utils import timezone

from apps.orders.inventory import available_quantity
from apps.orders.models import CartItem, Order, OrderItem, OrderShipment, ProcessingOption, StockReservation, VendorShippingOption
from apps.products.models import Product, SizeVariant
from apps.users.models import User
from apps.vendors.models import Vendor


@override_settings(KEEPZ_ENABLED=False)
class CartStockTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="buyer@example.com", password="test-password")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.product = Product.objects.create(title="Limited poster", base_price="100.00")
        self.variant = SizeVariant.objects.create(
            product=self.product,
            label="A3",
            price_usd="80.00",
            price_gel="100.00",
            stock=1,
        )

    def test_repeated_add_cannot_exceed_variant_stock(self):
        payload = {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"}

        self.assertEqual(self.client.post("/api/orders/cart/items/", payload, format="json").status_code, 200)
        response = self.client.post("/api/orders/cart/items/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(CartItem.objects.get().quantity, 1)

    def test_checkout_cors_preflight_allows_idempotency_header(self):
        response = self.client.options(
            "/api/orders/checkout/",
            HTTP_ORIGIN="http://localhost:3000",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,content-type,idempotency-key",
        )

        self.assertEqual(response.status_code, 200)
        allowed_headers = response.headers.get("Access-Control-Allow-Headers", "").lower()
        self.assertIn("idempotency-key", allowed_headers)

    def test_cart_quantity_update_cannot_exceed_variant_stock(self):
        response = self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )
        item_id = response.json()["items"][0]["id"]

        response = self.client.patch(
            f"/api/orders/cart/items/{item_id}/",
            {"quantity": 2},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(CartItem.objects.get(pk=item_id).quantity, 1)

    def test_expired_reservation_no_longer_reduces_available_stock(self):
        order = Order.objects.create(
            user=self.user,
            order_number="KOL-EXPIRED-RESERVATION",
            status="pending_payment",
            shipping_name="Buyer",
            shipping_line1="Street 1",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0108",
            shipping_country="GE",
            shipping_email=self.user.email,
            subtotal="100.00",
            total="100.00",
            currency="GEL",
        )
        order_item = OrderItem.objects.create(
            order=order,
            size_variant=self.variant,
            product_title=self.product.title,
            size_label=self.variant.label,
            finish_label="",
            frame_label="",
            price="100.00",
            quantity=1,
        )
        reservation = StockReservation.objects.create(
            order=order,
            order_item=order_item,
            size_variant=self.variant,
            quantity=1,
            expires_at=timezone.now() + timedelta(minutes=15),
        )

        self.assertEqual(available_quantity(self.variant), 0)
        blocked = self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400)
        reservation.expires_at = timezone.now() - timedelta(seconds=1)
        reservation.save(update_fields=["expires_at"])
        self.assertEqual(available_quantity(self.variant), 1)
        available_again = self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )
        self.assertEqual(available_again.status_code, 200)

    def test_reserved_ready_stock_can_be_added_as_made_to_order(self):
        option = ProcessingOption.objects.create(
            slug="standard-build",
            label="Standard build",
            est_days_min=3,
            est_days_max=5,
            price_usd="0.00",
            price_gel="0.00",
        )
        self.product.processing_options.add(option)
        order = Order.objects.create(
            user=self.user,
            order_number="KOL-MADE-TO-ORDER",
            status="pending_payment",
            shipping_name="Buyer",
            shipping_line1="Street 1",
            shipping_city="Tbilisi",
            shipping_state="Tbilisi",
            shipping_zip="0108",
            shipping_country="GE",
            shipping_email=self.user.email,
            subtotal="100.00",
            total="100.00",
            currency="GEL",
        )
        order_item = OrderItem.objects.create(
            order=order,
            size_variant=self.variant,
            product_title=self.product.title,
            size_label=self.variant.label,
            finish_label="",
            frame_label="",
            price="100.00",
            quantity=1,
        )
        StockReservation.objects.create(
            order=order,
            order_item=order_item,
            size_variant=self.variant,
            quantity=1,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        self.assertEqual(available_quantity(self.variant), 0)
        response = self.client.post(
            "/api/orders/cart/items/",
            {
                "size_variant_id": self.variant.id,
                "quantity": 1,
                "currency": "GEL",
                "processing_option": option.slug,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["processing_option"], "standard-build")

    def test_assigned_paid_processing_option_is_saved_and_priced(self):
        option = ProcessingOption.objects.create(
            slug="one-day",
            label="One day",
            est_days_min=1,
            est_days_max=1,
            price_usd="50.00",
            price_gel="100.00",
        )
        self.product.processing_options.add(option)

        response = self.client.post(
            "/api/orders/cart/items/",
            {
                "size_variant_id": self.variant.id,
                "quantity": 1,
                "currency": "GEL",
                "processing_option": option.slug,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        item = response.json()["items"][0]
        self.assertEqual(item["processing_option"], "one-day")
        self.assertEqual(item["processing_label"], "One day")
        self.assertEqual(item["processing_fee"], "100.00")
        self.assertEqual(item["line_total"], "200.00")

    def test_vendor_shipping_options_are_available_and_charged_at_checkout(self):
        vendor_user = User.objects.create_user(email="vendor@example.com", password="test-password")
        vendor = Vendor.objects.create(user=vendor_user, name="MangaMoon", slug="mangamoon")
        self.product.vendor = vendor
        self.product.save(update_fields=["vendor"])
        shipping = VendorShippingOption.objects.create(
            vendor=vendor,
            market="GE",
            label="Tbilisi courier",
            price="12.00",
            est_days_min=1,
            est_days_max=2,
            is_active=True,
        )
        add_response = self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )
        self.assertEqual(add_response.status_code, 200)

        options_response = self.client.get("/api/orders/cart/shipping-options/?country=GE")
        self.assertEqual(options_response.status_code, 200)
        self.assertEqual(options_response.json()[0]["slug"], f"vendor-{shipping.id}")

        checkout_response = self.client.post(
            "/api/orders/checkout/",
            {
                "shipping_name": "Buyer Test",
                "shipping_line1": "Rustaveli 1",
                "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi",
                "shipping_zip": "0108",
                "shipping_country": "GE",
                "shipping_email": "buyer@example.com",
                "shipping_phone": "+995555000000",
                "currency": "GEL",
                "delivery_type": f"vendor-{shipping.id}",
            },
            format="json",
        )

        self.assertEqual(checkout_response.status_code, 201)
        order = Order.objects.get()
        self.assertEqual(order.delivery_type, f"vendor-{shipping.id}")
        self.assertEqual(str(order.delivery_price), "12.00")
        self.assertEqual(str(order.discount), "0.00")
        self.assertEqual(str(order.total), "112.00")

    def test_non_sculpi_vendor_can_use_free_self_pickup(self):
        vendor_user = User.objects.create_user(email="mangamoon@example.com", password="test-password")
        vendor = Vendor.objects.create(
            user=vendor_user,
            name="MangaMoon",
            slug="mangamoon",
            catalog_category_slug="wallpanels",
        )
        self.product.vendor = vendor
        self.product.save(update_fields=["vendor"])
        self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )

        options_response = self.client.get("/api/orders/cart/shipping-options/?country=GE")
        pickup = next(option for option in options_response.json() if option["is_pickup"])
        self.assertEqual(pickup["slug"], f"pickup-{vendor.id}")
        self.assertEqual(pickup["price"], "0.00")

        checkout_response = self.client.post(
            "/api/orders/checkout/",
            {
                "shipping_name": "Buyer Test",
                "shipping_line1": "Rustaveli 1",
                "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi",
                "shipping_zip": "0108",
                "shipping_country": "GE",
                "shipping_email": "buyer@example.com",
                "shipping_phone": "+995555000000",
                "currency": "GEL",
                "delivery_type": "per-vendor",
                "shipping_selections": {str(vendor.id): f"pickup-{vendor.id}"},
            },
            format="json",
        )

        self.assertEqual(checkout_response.status_code, 201, checkout_response.data)
        order = Order.objects.get()
        shipment = OrderShipment.objects.get(order=order)
        self.assertEqual(str(order.delivery_price), "0.00")
        self.assertEqual(shipment.delivery_type, "self-pickup")
        self.assertEqual(shipment.delivery_label, "I will take it myself")
        self.assertEqual(str(shipment.delivery_price), "0.00")

    def test_sculpi_pickup_is_hidden_and_rejected_server_side(self):
        vendor_user = User.objects.create_user(email="vendor2@kolekcia.com", password="test-password")
        vendor = Vendor.objects.create(
            user=vendor_user,
            name="Sculpi",
            slug="sculpi",
            catalog_category_slug="figures",
        )
        self.product.vendor = vendor
        self.product.save(update_fields=["vendor"])
        VendorShippingOption.objects.create(
            vendor=vendor,
            market="GE",
            label="Figure delivery",
            price="15.00",
            is_active=True,
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )

        options_response = self.client.get("/api/orders/cart/shipping-options/?country=GE")
        self.assertFalse(any(option.get("is_pickup") for option in options_response.json()))

        checkout_response = self.client.post(
            "/api/orders/checkout/",
            {
                "shipping_name": "Buyer Test",
                "shipping_line1": "Rustaveli 1",
                "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi",
                "shipping_zip": "0108",
                "shipping_country": "GE",
                "shipping_email": "buyer@example.com",
                "shipping_phone": "+995555000000",
                "currency": "GEL",
                "delivery_type": "per-vendor",
                "shipping_selections": {str(vendor.id): f"pickup-{vendor.id}"},
            },
            format="json",
        )

        self.assertEqual(checkout_response.status_code, 400)
        self.assertEqual(checkout_response.data["detail"], "Self-pickup is not available for this vendor.")
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 1)

    def test_checkout_retry_with_same_idempotency_key_returns_one_order(self):
        self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )
        payload = {
            "shipping_name": "Buyer Test",
            "shipping_line1": "Rustaveli 1",
            "shipping_city": "Tbilisi",
            "shipping_state": "Tbilisi",
            "shipping_zip": "0108",
            "shipping_country": "GE",
            "shipping_email": "buyer@example.com",
            "shipping_phone": "+995555000000",
            "currency": "GEL",
            "delivery_type": "standard",
        }

        first = self.client.post(
            "/api/orders/checkout/", payload, format="json",
            HTTP_IDEMPOTENCY_KEY="checkout-retry-test",
        )
        second = self.client.post(
            "/api/orders/checkout/", payload, format="json",
            HTTP_IDEMPOTENCY_KEY="checkout-retry-test",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["id"], second.json()["id"])
        self.assertEqual(Order.objects.count(), 1)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)

    @override_settings(KEEPZ_ENABLED=True)
    @patch("apps.orders.keepz.create_keepz_order_for_checkout")
    def test_payment_redirect_reserves_without_decrementing_stock(self, create_keepz_order):
        create_keepz_order.return_value = SimpleNamespace(
            payment_url="https://gateway.dev.keepz.me/pay/test",
            request_payload={"amount": 100.0, "currency": "GEL"},
            provider_payload={"urlForQR": "https://gateway.dev.keepz.me/pay/test"},
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )

        response = self.client.post(
            "/api/orders/checkout/",
            {
                "shipping_name": "Buyer Test",
                "shipping_line1": "Rustaveli 1",
                "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi",
                "shipping_zip": "0108",
                "shipping_country": "GE",
                "shipping_email": "buyer@example.com",
                "shipping_phone": "+995555000000",
                "currency": "GEL",
                "delivery_type": "standard",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="reservation-before-payment-test",
        )

        self.assertEqual(response.status_code, 201)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 1)
        reservation = StockReservation.objects.get()
        self.assertEqual(reservation.status, StockReservation.STATUS_ACTIVE)
        self.assertEqual(available_quantity(self.variant), 0)

    @override_settings(KEEPZ_ENABLED=True)
    @patch("apps.orders.keepz.create_keepz_order_for_checkout")
    def test_keepz_rejection_rolls_back_order_stock_and_cart(self, create_keepz_order):
        from apps.orders.keepz import KeepzGatewayError

        create_keepz_order.side_effect = KeepzGatewayError(
            "Keepz order creation failed.",
            {"message": "Test gateway rejection", "statusCode": 6000},
        )
        self.client.post(
            "/api/orders/cart/items/",
            {"size_variant_id": self.variant.id, "quantity": 1, "currency": "GEL"},
            format="json",
        )

        response = self.client.post(
            "/api/orders/checkout/",
            {
                "shipping_name": "Buyer Test",
                "shipping_line1": "Rustaveli 1",
                "shipping_city": "Tbilisi",
                "shipping_state": "Tbilisi",
                "shipping_zip": "0108",
                "shipping_country": "GE",
                "shipping_email": "buyer@example.com",
                "shipping_phone": "+995555000000",
                "currency": "GEL",
                "delivery_type": "standard",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="keepz-rejection-test",
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn("Test gateway rejection", response.data["detail"])
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(CartItem.objects.count(), 1)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 1)
