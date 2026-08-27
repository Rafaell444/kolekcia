from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.orders.models import CustomOrder, PaymentSession
from apps.users.models import User
from apps.vendors.models import Vendor


class CustomOrderPaymentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="customer@example.com", password="Test1234!")
        self.vendor_user = User.objects.create_user(email="vendor@example.com", password="Test1234!")
        self.vendor = Vendor.objects.create(user=self.vendor_user, name="QA Vendor", slug="qa-vendor")
        self.order = CustomOrder.objects.create(
            user=self.user,
            vendor=self.vendor,
            product_type="Custom poster",
            name="Customer",
            email=self.user.email,
            status="approved",
            price=Decimal("75.00"),
            currency="GEL",
            payment_url="https://old.example/pay",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @override_settings(KEEPZ_ENABLED=True)
    @patch("apps.orders.keepz.create_keepz_order_for_custom_order")
    def test_customer_payment_endpoint_regenerates_custom_order_link(self, create_keepz_order):
        create_keepz_order.return_value.payment_url = "https://keepz.example/fresh"
        create_keepz_order.return_value.request_payload = {"amount": "75.00"}
        create_keepz_order.return_value.provider_payload = {"integratorOrderId": "fresh-id"}

        response = self.client.post(f"/api/orders/custom/mine/{self.order.pk}/payment/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["payment_url"], "https://keepz.example/fresh")
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_url, "https://keepz.example/fresh")
        payment = PaymentSession.objects.get(purpose=PaymentSession.PURPOSE_CUSTOM_ORDER)
        self.assertEqual(payment.status, PaymentSession.STATUS_REDIRECTED)
        self.assertEqual(payment.related_id, str(self.order.pk))
