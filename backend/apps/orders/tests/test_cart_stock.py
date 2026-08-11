from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import CartItem, Order, OrderShipment, ProcessingOption, VendorShippingOption
from apps.products.models import Product, SizeVariant
from apps.users.models import User
from apps.vendors.models import Vendor


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
