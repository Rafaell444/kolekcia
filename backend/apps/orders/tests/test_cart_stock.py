from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import CartItem, Order, ProcessingOption, VendorShippingOption
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
