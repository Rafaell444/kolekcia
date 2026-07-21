from types import SimpleNamespace
from unittest.mock import MagicMock

from django.test import SimpleTestCase

from apps.core.seo import SEOModelMixin


def _make_seo_stub(**attrs):
    """Lightweight stand-in for SEOModelMixin helpers (no DB)."""
    defaults = {
        "title": "Neon Poster",
        "name": "Neon Poster",
        "meta_title": "",
        "meta_description": "",
        "meta_keywords": "",
        "meta_title_en": "",
        "meta_description_en": "",
        "SEO_AUTO_TITLE": "{name} | Koleqcia",
        "SEO_AUTO_DESCRIPTION": "Buy {name}.",
        "SEO_TEMPLATES": {
            "en": {
                "title": "{name} | Koleqcia",
                "description": "Shop {name} metal art.",
            }
        },
    }
    defaults.update(attrs)
    stub = SimpleNamespace(**defaults)

    # Mimic django.db.models.Model._meta.get_fields()
    fields = []
    for name in ("title", "name", "meta_title", "meta_description", "meta_keywords"):
        f = MagicMock()
        f.name = name
        f.attname = name
        fields.append(f)
    stub._meta = MagicMock()
    stub._meta.get_fields.return_value = fields
    return stub


class SEOModelMixinTests(SimpleTestCase):
    def test_seo_context_includes_title_and_name(self):
        obj = _make_seo_stub()
        ctx = SEOModelMixin._seo_context(obj, lang=None)
        self.assertEqual(ctx.get("title"), "Neon Poster")
        self.assertEqual(ctx.get("name"), "Neon Poster")

    def test_seo_context_fills_name_from_title_when_name_missing(self):
        obj = _make_seo_stub()
        # Only expose title field so name is absent from ctx until fallback
        title_field = MagicMock()
        title_field.name = "title"
        title_field.attname = "title"
        obj._meta.get_fields.return_value = [title_field]
        delattr(obj, "name")
        ctx = SEOModelMixin._seo_context(obj, lang=None)
        self.assertEqual(ctx.get("title"), "Neon Poster")
        self.assertEqual(ctx.get("name"), "Neon Poster")

    def test_populate_seo_for_lang_fills_empty_fields(self):
        obj = _make_seo_stub()
        ctx = SEOModelMixin._seo_context(obj, lang="en")
        SEOModelMixin._populate_seo_for_lang(obj, "en", ctx)
        self.assertEqual(obj.meta_title_en, "Neon Poster | Koleqcia")
        self.assertEqual(obj.meta_description_en, "Shop Neon Poster metal art.")

    def test_populate_skips_when_already_set(self):
        obj = _make_seo_stub(meta_title_en="Custom Title", meta_description_en="Custom Desc")
        ctx = SEOModelMixin._seo_context(obj, lang="en")
        SEOModelMixin._populate_seo_for_lang(obj, "en", ctx)
        self.assertEqual(obj.meta_title_en, "Custom Title")
        self.assertEqual(obj.meta_description_en, "Custom Desc")
