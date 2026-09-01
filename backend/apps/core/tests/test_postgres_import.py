import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import skipUnless
from uuid import uuid4

from django.core.management import call_command, CommandError
from django.db import IntegrityError, connection
from django.test import TestCase

from apps.emails.models import EmailTemplate
from apps.products.models import Product


@skipUnless(connection.vendor == "postgresql", "PostgreSQL-only snapshot importer")
class PostgreSQLSnapshotImportTests(TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "snapshot.json"
        self.record = {
            "model": "users.user", "pk": str(uuid4()),
            "fields": {
                "email": "import-test@example.com", "password": "!",
                "date_joined": "2026-01-01T00:00:00Z",
            },
        }

    def run_import(self, records):
        self.path.write_text(json.dumps(records), encoding="utf-8")
        call_command("import_database_snapshot", str(self.path), stdout=StringIO())

    def test_import_preserves_uuid_and_removes_extra_seed_templates(self):
        from apps.users.models import User
        self.assertTrue(EmailTemplate.objects.exists())
        self.run_import([self.record])
        self.assertTrue(User.objects.filter(pk=self.record["pk"]).exists())
        self.assertEqual(User.objects.count(), 1)
        self.assertFalse(EmailTemplate.objects.exists())

    def test_existing_business_data_blocks_import(self):
        product = Product.objects.create(title="Must remain", base_price=10)
        before = EmailTemplate.objects.count()
        with self.assertRaisesMessage(CommandError, "Destination is not fresh"):
            self.run_import([self.record])
        self.assertTrue(Product.objects.filter(pk=product.pk).exists())
        self.assertEqual(EmailTemplate.objects.count(), before)

    def test_failed_import_restores_seed_templates(self):
        before = EmailTemplate.objects.count()
        invalid = {"model": "products.product", "pk": 999, "fields": {
            "title": "Invalid product", "slug": "invalid", "base_price": None,
        }}
        with self.assertRaises(IntegrityError):
            self.run_import([self.record, invalid])
        from apps.users.models import User
        self.assertFalse(User.objects.exists())
        self.assertEqual(EmailTemplate.objects.count(), before)

    def test_primary_keys_are_required(self):
        self.record.pop("pk")
        with self.assertRaisesMessage(CommandError, "retain its primary key"):
            self.run_import([self.record])

    def test_import_resets_integer_primary_key_sequence(self):
        from apps.products.models import Category
        self.run_import([{
            "model": "products.category", "pk": 5000,
            "fields": {"name": "Imported", "slug": "imported"},
        }])
        category = Category.objects.create(name="New category", slug="new-category")
        self.assertGreater(category.pk, 5000)
