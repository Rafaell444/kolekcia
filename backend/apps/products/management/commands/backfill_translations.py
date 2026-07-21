from django.core.management.base import BaseCommand
from django.utils.text import capfirst

from apps.products.models import Category, Product


def _first_nonempty(*values: str | None) -> str:
    for value in values:
        if value and str(value).strip():
            return str(value).strip()
    return ""


class Command(BaseCommand):
    help = (
        "Backfill empty Category/Product translation fields from English "
        "(or slug/title fallback) so ka/ru locales do not render blank labels."
    )

    def handle(self, *args, **options):
        cat_fixed = 0
        for cat in Category.objects.all():
            en = _first_nonempty(cat.name_en, cat.name_ka, cat.name_ru, capfirst(cat.slug.replace("-", " ")))
            changed = False
            if not (cat.name_en or "").strip() and en:
                cat.name_en = en
                changed = True
            if not (cat.name_ka or "").strip() and en:
                cat.name_ka = en
                changed = True
            if not (cat.name_ru or "").strip() and en:
                cat.name_ru = en
                changed = True
            if changed:
                cat.save()
                cat_fixed += 1
                self.stdout.write(f"  category {cat.slug}: {en}")

        prod_fixed = 0
        for product in Product.objects.all().iterator():
            en_title = _first_nonempty(
                product.title_en, product.title_ka, product.title_ru, product.slug.replace("-", " ").title()
            )
            en_desc = _first_nonempty(product.description_en, product.description_ka, product.description_ru)
            changed = False
            if not (product.title_en or "").strip() and en_title:
                product.title_en = en_title
                changed = True
            if not (product.title_ka or "").strip() and en_title:
                product.title_ka = en_title
                changed = True
            if not (product.title_ru or "").strip() and en_title:
                product.title_ru = en_title
                changed = True
            if en_desc:
                if not (product.description_en or "").strip():
                    product.description_en = en_desc
                    changed = True
                if not (product.description_ka or "").strip():
                    product.description_ka = en_desc
                    changed = True
                if not (product.description_ru or "").strip():
                    product.description_ru = en_desc
                    changed = True
            if changed:
                product.save()
                prod_fixed += 1

        self.stdout.write(self.style.SUCCESS(
            f"Backfilled {cat_fixed} categories and {prod_fixed} products."
        ))
