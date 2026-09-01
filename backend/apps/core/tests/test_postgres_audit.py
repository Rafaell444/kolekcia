from io import StringIO
from unittest import skipUnless

from django.core.management import call_command, CommandError
from django.db import connection
from django.test import TestCase

from apps.orders.models import PaymentSession
from apps.products.models import Product


class PostgreSQLDataAuditTests(TestCase):
    def test_long_provider_url_is_preserved_and_passes_audit(self):
        url = "https://example.com/payment?token=" + "x" * 400
        payment = PaymentSession.objects.create(
            purpose="custom_order", amount="10.00", currency="GEL", payment_url=url
        )
        output = StringIO()
        call_command("audit_postgres_data", stdout=output)
        payment.refresh_from_db()
        self.assertEqual(payment.payment_url, url)
        self.assertIn("audit passed", output.getvalue())

    @skipUnless(connection.vendor == "sqlite", "PostgreSQL already rejects oversized text")
    def test_oversized_sqlite_text_is_reported_without_modification(self):
        product = Product.objects.create(title="x" * 256, slug="oversized", base_price=10)
        errors = StringIO()
        with self.assertRaises(CommandError):
            call_command("audit_postgres_data", stderr=errors)
        product.refresh_from_db()
        self.assertEqual(len(product.title), 256)
        self.assertIn("products.Product.title", errors.getvalue())
        self.assertNotIn("x" * 256, errors.getvalue())

    @skipUnless(connection.vendor == "sqlite", "PostgreSQL already rejects NUL text")
    def test_nul_text_is_reported_without_modification(self):
        product = Product.objects.create(title="Test", base_price=10, description="a\x00b")
        errors = StringIO()
        with self.assertRaises(CommandError):
            call_command("audit_postgres_data", stderr=errors)
        product.refresh_from_db()
        self.assertEqual(product.description, "a\x00b")
        self.assertIn("NUL character", errors.getvalue())
