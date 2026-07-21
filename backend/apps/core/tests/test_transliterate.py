from django.test import SimpleTestCase

from apps.core.transliterate import smart_slugify, smart_transliterate


class TransliterateTests(SimpleTestCase):
    def test_georgian_transliteration(self):
        self.assertIn("k", smart_transliterate("კოლექცია").lower())

    def test_cyrillic_transliteration(self):
        result = smart_transliterate("Коллекция")
        self.assertTrue(result.isascii())

    def test_smart_slugify_latin(self):
        self.assertEqual(smart_slugify("Hello World!"), "hello-world")

    def test_smart_slugify_georgian(self):
        slug = smart_slugify("კედლის პანელი")
        self.assertTrue(slug)
        self.assertTrue(all(c.isalnum() or c == "-" for c in slug))

    def test_smart_slugify_empty_fallback(self):
        self.assertEqual(smart_slugify("!!!"), "item")
