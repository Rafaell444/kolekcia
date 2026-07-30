from django.test import TestCase

from apps.users.models import User
from apps.vendors.models import Vendor
from apps.vendors.views import _apply_vendor_fields


class VendorTranslationTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(email="vendor-translations@example.com", password="test-pass-123")
        self.vendor = Vendor.objects.create(
            user=user,
            name="English Store",
            slug="translation-store",
            description="English description",
            custom_product_type="Print",
        )

    def test_admin_update_persists_vendor_translations(self):
        _apply_vendor_fields(
            self.vendor,
            {
                "name_ka": "ქართული მაღაზია",
                "name_ru": "Русский магазин",
                "description_ka": "ქართული აღწერა",
                "description_ru": "Русское описание",
            },
        )
        self.vendor.refresh_from_db()

        self.assertEqual(self.vendor.name_ka, "ქართული მაღაზია")
        self.assertEqual(self.vendor.name_ru, "Русский магазин")
        self.assertEqual(self.vendor.description_ka, "ქართული აღწერა")
        self.assertEqual(self.vendor.description_ru, "Русское описание")

    def test_public_endpoint_uses_requested_locale(self):
        self.vendor.name_ka = "ქართული მაღაზია"
        self.vendor.description_ka = "ქართული აღწერა"
        self.vendor.name_ru = "Русский магазин"
        self.vendor.description_ru = "Русское описание"
        self.vendor.save()

        ka_data = self.client.get("/api/vendors/public/?lang=ka").json()[0]
        ru_data = self.client.get("/api/vendors/public/?lang=ru").json()[0]

        self.assertEqual(ka_data["name"], "ქართული მაღაზია")
        self.assertEqual(ka_data["description"], "ქართული აღწერა")
        self.assertEqual(ru_data["name"], "Русский магазин")
        self.assertEqual(ru_data["description"], "Русское описание")
