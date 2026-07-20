from django.db import models
from django.conf import settings


class SEOModelMixin(models.Model):
    """
    Abstract mixin that adds meta_title, meta_description, and meta_keywords
    to any model. Each field is registered with django-modeltranslation for
    per-language overrides.

    Subclasses may define per-language SEO templates via:

        SEO_TEMPLATES = {
            "en": {"title": "...", "description": "..."},
            "ka": {"title": "...", "description": "..."},
            "ru": {"title": "...", "description": "..."},
        }

    Format strings use {name}, {category_name}, {vendor_name} placeholders.

    For backward compatibility, SEO_AUTO_TITLE / SEO_AUTO_DESCRIPTION are
    still honoured as a single-language fallback when SEO_TEMPLATES is absent.
    """

    SEO_AUTO_TITLE: str | None = None
    SEO_AUTO_DESCRIPTION: str | None = None
    SEO_TEMPLATES: dict[str, dict[str, str]] | None = None

    meta_title = models.CharField(max_length=200, blank=True)
    meta_description = models.TextField(max_length=500, blank=True)
    meta_keywords = models.CharField(max_length=300, blank=True)

    class Meta:
        abstract = True

    def _seo_context(self, lang: str | None = None) -> dict:
        """
        Build a context dict for SEO format strings.
        When *lang* is provided, reads the language-specific fields
        (e.g. title_ka, name_en) so the template is populated with
        the correct translation.
        """
        ctx: dict = {}
        for field in self._meta.get_fields():
            if not hasattr(field, "attname"):
                continue
            base_name = field.name
            if lang:
                val = (
                    getattr(self, f"{base_name}_{lang}", None)
                    or getattr(self, f"{base_name}_en", None)
                    or getattr(self, base_name, None)
                )
            else:
                val = getattr(self, field.attname, None)
            if isinstance(val, str):
                ctx[base_name] = val

        def _resolve_related(obj, attr: str, lang_code: str | None) -> str:
            if lang_code:
                return (
                    getattr(obj, f"{attr}_{lang_code}", None)
                    or getattr(obj, f"{attr}_en", None)
                    or getattr(obj, attr, "")
                    or ""
                )
            return getattr(obj, attr, "") or ""

        if hasattr(self, "category") and self.category:
            ctx["category_name"] = _resolve_related(self.category, "name", lang)

        if hasattr(self, "vendor") and self.vendor:
            ctx["vendor_name"] = _resolve_related(self.vendor, "name", lang)

        name = ctx.get("title") or ctx.get("name", "")
        ctx.setdefault("name", name)

        return ctx

    def _populate_seo_for_lang(self, lang: str, ctx: dict) -> None:
        """Fill empty meta_title_{lang} and meta_description_{lang}."""
        title_field = f"meta_title_{lang}"
        desc_field = f"meta_description_{lang}"

        templates = self.SEO_TEMPLATES or {}
        lang_tpl = templates.get(lang, {})

        title_tpl = lang_tpl.get("title")
        desc_tpl = lang_tpl.get("description")

        if not title_tpl and lang == "en":
            title_tpl = self.SEO_AUTO_TITLE
        if not desc_tpl and lang == "en":
            desc_tpl = self.SEO_AUTO_DESCRIPTION

        if not getattr(self, title_field, "") and title_tpl:
            try:
                setattr(self, title_field, title_tpl.format(**ctx)[:200])
            except (KeyError, IndexError):
                pass

        if not getattr(self, desc_field, "") and desc_tpl:
            try:
                setattr(self, desc_field, desc_tpl.format(**ctx)[:500])
            except (KeyError, IndexError):
                pass

    def save(self, *args, **kwargs):
        langs = [code for code, _ in getattr(settings, "LANGUAGES", [("en", "English")])]
        for lang in langs:
            ctx = self._seo_context(lang=lang)
            self._populate_seo_for_lang(lang, ctx)
        super().save(*args, **kwargs)
