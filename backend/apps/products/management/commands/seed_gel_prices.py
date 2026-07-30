"""
Seed missing regional SizeVariant prices from USD.

GEL prices are written as admin market prices (USD × 2.65).
Does not touch rows that already have price_gel set.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand

from apps.products.models import SizeVariant

GEL_RATE = Decimal("2.65")


class Command(BaseCommand):
    help = "Seed missing SizeVariant price_gel / sale_price_gel from USD (×2.65)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing GEL prices too.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        updated = 0
        for sv in SizeVariant.objects.select_related("product").all():
            fields = []
            if force or sv.price_gel is None:
                if sv.price_usd is not None:
                    sv.price_gel = (Decimal(sv.price_usd) * GEL_RATE).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                    fields.append("price_gel")
            if sv.sale_price_usd is not None and (force or sv.sale_price_gel is None):
                sv.sale_price_gel = (Decimal(sv.sale_price_usd) * GEL_RATE).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                fields.append("sale_price_gel")
            if fields:
                sv.save(update_fields=fields)
                updated += 1
                self.stdout.write(
                    f"  {sv.product.title} / {sv.label}: "
                    f"USD {sv.price_usd} → GEL {sv.price_gel}"
                )
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} size variant(s)."))
