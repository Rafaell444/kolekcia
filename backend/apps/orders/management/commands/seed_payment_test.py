"""Create the minimum data needed to rehearse a live Keepz payment.

Deliberately cheap (0.10 / 0.15 GEL) so a real charge stays trivial, and
deliberately split across two existing vendors with different Keepz receiver
IDs so the settlement can be traced to a specific wallet. The two prices differ
so the amount landing in each wallet identifies which vendor it came from.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Seed cheap two-vendor products for an end-to-end Keepz payment test."

    def add_arguments(self, parser):
        parser.add_argument(
            "--points",
            type=int,
            default=500,
            help="Spendable + lifetime points to grant the test buyer.",
        )
        parser.add_argument(
            "--buyer",
            default="",
            help="Email of the buyer account to top up with points.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.products.models import Artist, Category, Product, SizeVariant
        from apps.vendors.models import Vendor

        vendors = list(Vendor.objects.order_by("pk")[:2])
        if len(vendors) < 2:
            self.stderr.write(
                "Need at least two vendors to test a split payment; found "
                f"{len(vendors)}."
            )
            return

        missing = [v.name for v in vendors if not v.merchant_id]
        if missing:
            self.stderr.write(
                "These vendors have no Keepz merchant_id, so their share cannot be "
                f"routed: {', '.join(missing)}"
            )
            return
        if vendors[0].merchant_id == vendors[1].merchant_id:
            self.stdout.write(
                self.style.WARNING(
                    "Both vendors share a receiver ID — the split will land in one wallet."
                )
            )

        # Asymmetric prices so each wallet's balance says which vendor it came from.
        prices = [Decimal("0.15"), Decimal("0.10")]

        created = []
        for vendor, price_gel in zip(vendors, prices):
            category = (
                Category.objects.filter(slug=vendor.catalog_category_slug).first()
                or Category.objects.first()
            )
            artist = (
                Artist.objects.filter(vendor=vendor).first()
                or Artist.objects.create(
                    handle=f"{vendor.slug}-test-artist",
                    name=f"{vendor.name} Test",
                    vendor=vendor,
                )
            )

            slug = f"paytest-{vendor.slug}"
            product, _ = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "title": f"Payment Test — {vendor.name}",
                    "category": category,
                    "vendor": vendor,
                    "artist": artist,
                    "base_price": price_gel,
                    "status": "active",
                    "description": (
                        f"Disposable {price_gel} GEL fixture for rehearsing the Keepz "
                        f"payment, split, and refund flow. Routes to {vendor.name}."
                    ),
                    "is_ready_to_ship": True,
                    "processing_time_label": "",
                    # A sale badge would make the charged amount unpredictable.
                    "is_sale": False,
                    "original_price": None,
                },
            )
            if category:
                product.categories.add(category)

            variant, _ = SizeVariant.objects.update_or_create(
                product=product,
                label="Standard",
                defaults={
                    "price_gel": price_gel,
                    # Keep USD low too so a foreign-market test stays cheap.
                    "price_usd": price_gel,
                    "stock": 10,
                    "is_ready_to_ship": True,
                    "is_active": True,
                    "sale_price_gel": None,
                    "sale_price_usd": None,
                },
            )
            created.append((product, variant, vendor, price_gel))

        self.stdout.write(self.style.SUCCESS("Seeded payment test fixtures:"))
        for product, variant, vendor, price_gel in created:
            self.stdout.write(
                f"  {price_gel} GEL  {vendor.name:<12} receiver={vendor.merchant_id} "
                f"  /catalog/{product.slug}"
            )
        total = sum(price for *_, price in created)
        self.stdout.write(f"  Split cart total (one of each): {total} GEL")

        buyer_email = options["buyer"]
        if buyer_email:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            buyer = User.objects.filter(email__iexact=buyer_email).first()
            if not buyer:
                self.stderr.write(f"No user with email {buyer_email}; skipped points.")
            else:
                points = options["points"]
                buyer.spendable_points = points
                buyer.lifetime_points = max(buyer.lifetime_points or 0, points)
                buyer.save(update_fields=["spendable_points", "lifetime_points"])
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Granted {points} points to {buyer.email} "
                        f"(lifetime {buyer.lifetime_points})."
                    )
                )
