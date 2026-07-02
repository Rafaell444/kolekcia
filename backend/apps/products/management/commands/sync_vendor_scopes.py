from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Backfill vendor-scoped products, vendor users, and tenant product sets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing to database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        self.stdout.write(self.style.MIGRATE_HEADING("Syncing vendor scopes..."))
        merged_vendors = self._canonicalize_vendors(dry_run=dry_run)
        updated_products = self._sync_product_vendors(dry_run=dry_run)
        normalized_users = self._normalize_vendor_users(dry_run=dry_run)
        synced_tenants = self._sync_tenants(dry_run=dry_run)
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. merged_vendors={merged_vendors}, products={updated_products}, vendor_users={normalized_users}, tenants={synced_tenants}"
            )
        )

    def _canonicalize_vendors(self, dry_run=False):
        from apps.vendors.models import Vendor
        from apps.users.models import User
        from apps.products.models import Product, Artist
        from apps.orders.models import OrderItem, CustomOrder
        from apps.messaging.models import Conversation

        canonical_specs = [
            {
                "target_user_email": "vendor1@kolekcia.com",
                "target_name": "Panel Studio",
                "target_slug": "panel-studio",
                "legacy_slug_candidates": ["kolekcia", "panel-studio"],
            },
            {
                "target_user_email": "vendor2@kolekcia.com",
                "target_name": "Figure Studio",
                "target_slug": "figure-studio",
                "legacy_slug_candidates": ["noir", "figure-studio"],
            },
        ]

        merged = 0
        for spec in canonical_specs:
            user = User.objects.filter(email=spec["target_user_email"]).first()
            if not user:
                continue

            target = Vendor.objects.filter(user=user).first()
            if not target:
                target = Vendor.objects.filter(slug=spec["target_slug"]).first()
            if not target:
                continue

            sources = Vendor.objects.filter(slug__in=spec["legacy_slug_candidates"]).exclude(pk=target.pk)
            for src in sources:
                merged += 1
                if not dry_run:
                    Product.objects.filter(vendor=src).update(vendor=target)
                    Artist.objects.filter(vendor=src).update(vendor=target)
                    OrderItem.objects.filter(vendor=src).update(vendor=target)
                    CustomOrder.objects.filter(vendor=src).update(vendor=target)
                    Conversation.objects.filter(vendor=src).update(vendor=target)
                    src.delete()

            if not dry_run:
                target.user = user
                target.name = spec["target_name"]
                target.slug = spec["target_slug"]
                target.save(update_fields=["user", "name", "slug"])

        return merged

    def _sync_product_vendors(self, dry_run=False):
        from apps.products.models import Product
        from apps.vendors.models import Vendor

        panel_vendor = Vendor.objects.filter(slug="panel-studio").first()
        figure_vendor = Vendor.objects.filter(slug="figure-studio").first()
        updated = 0

        for product in Product.objects.select_related("artist", "category", "vendor"):
            target_vendor = product.vendor
            if not target_vendor and product.artist and product.artist.vendor:
                target_vendor = product.artist.vendor
            if not target_vendor and product.category:
                if product.category.slug == "wallpanels":
                    target_vendor = panel_vendor
                elif product.category.slug == "figures":
                    target_vendor = figure_vendor
            if target_vendor and product.vendor_id != target_vendor.id:
                updated += 1
                if not dry_run:
                    product.vendor = target_vendor
                    product.save(update_fields=["vendor"])
        return updated

    def _normalize_vendor_users(self, dry_run=False):
        from apps.users.models import User
        from apps.vendors.models import Vendor

        changed = 0
        vendor_emails = []
        for slug in ("panel-studio", "figure-studio"):
            v = Vendor.objects.select_related("user").filter(slug=slug).first()
            if v and v.user:
                vendor_emails.append(v.user.email)

        for user in User.objects.filter(email__in=vendor_emails):
            if user.is_superuser or user.is_staff:
                changed += 1
                if not dry_run:
                    user.is_superuser = False
                    user.is_staff = False
                    if user.role == "customer":
                        user.role = "staff"
                    user.save(update_fields=["is_superuser", "is_staff", "role"])
        return changed

    def _sync_tenants(self, dry_run=False):
        from apps.tenants.models import Tenant
        from apps.users.models import User
        from apps.vendors.models import Vendor

        tenant_specs = [
            ("wallpanels", "Wallpanels", "panel-studio", "vendor1@kolekcia.com"),
            ("figures", "Figures", "figure-studio", "vendor2@kolekcia.com"),
        ]

        storefront_defaults = {
            "panel-studio": {
                "catalog_category_slug": "wallpanels",
                "banner_url": "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1600&h=600&fit=crop",
                "description": "Ultra-HD 3D relief metal wallpanels with proprietary UV-cure layering — sculptural art for every wall.",
                "social_facebook": "https://facebook.com",
                "social_instagram": "https://instagram.com",
                "social_tiktok": "https://tiktok.com",
                "social_youtube": "https://youtube.com",
            },
            "figure-studio": {
                "catalog_category_slug": "figures",
                "banner_url": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&h=600&fit=crop",
                "description": "Precision-printed 3D collectible figures — from anime icons to original characters, crafted for collectors.",
                "social_facebook": "https://facebook.com",
                "social_instagram": "https://instagram.com",
                "social_tiktok": "https://tiktok.com",
                "social_youtube": "https://youtube.com",
            },
        }

        touched = 0
        for tenant_id, tenant_name, vendor_slug, owner_email in tenant_specs:
            owner = User.objects.filter(email=owner_email).first()
            vendor = Vendor.objects.filter(slug=vendor_slug).first()
            if not vendor:
                continue
            touched += 1
            if dry_run:
                continue

            defaults = storefront_defaults.get(vendor_slug, {})
            vendor.catalog_category_slug = tenant_id
            for field, value in defaults.items():
                if field == "catalog_category_slug":
                    continue
                if field == "banner_url" and value:
                    vendor.banner_url = value
                elif value and not getattr(vendor, field, None):
                    setattr(vendor, field, value)
            if not vendor.description and defaults.get("description"):
                vendor.description = defaults["description"]

            vendor.save()

            tenant, _ = Tenant.objects.get_or_create(id=tenant_id, defaults={"name": tenant_name, "owner": owner})
            tenant.name = tenant_name
            if owner:
                tenant.owner = owner
            tenant.save(update_fields=["name", "owner"])
            tenant.products.set(vendor.products.all())
        return touched

