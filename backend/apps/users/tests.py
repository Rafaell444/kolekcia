from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import Address, User


class AddressValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="address@example.com", password="test-password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_rejects_whitespace_address_fields_with_field_errors(self):
        response = self.client.post(
            "/api/auth/addresses/",
            {
                "label": "   ",
                "line1": "\t",
                "line2": "optional",
                "city": " ",
                "state": "",
                "zip_code": "   ",
                "country": " ",
                "is_default": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        for field in ("label", "line1", "city", "state", "zip_code", "country"):
            self.assertIn(field, data)
        self.assertFalse(Address.objects.exists())

    def test_trims_valid_address_before_saving(self):
        response = self.client.post(
            "/api/auth/addresses/",
            {
                "label": "  Home  ",
                "line1": "  Rustaveli 1  ",
                "line2": "  Apt 4  ",
                "city": "  Tbilisi  ",
                "state": "  Tbilisi  ",
                "zip_code": "  0108  ",
                "country": "  GE  ",
                "is_default": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        address = Address.objects.get()
        self.assertEqual(address.label, "Home")
        self.assertEqual(address.line1, "Rustaveli 1")
        self.assertEqual(address.line2, "Apt 4")
        self.assertEqual(address.city, "Tbilisi")
        self.assertEqual(address.state, "Tbilisi")
        self.assertEqual(address.zip_code, "0108")
        self.assertEqual(address.country, "GE")
