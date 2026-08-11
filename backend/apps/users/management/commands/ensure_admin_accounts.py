from django.core.management.base import BaseCommand
from django.db import transaction

from apps.users.models import User
from apps.vendors.models import Vendor


ACCOUNTS = {
    "superadmin": {
        "email": "admin@kolekcia.com",
        "password": "admin12345",
        "name": "Superadmin",
    },
    "vendors": [
        {
            "email": "vendor1@kolekcia.com",
            "password": "vendor12345",
            "name": "MangaMoon",
            "slug": "mangamoon",
            "catalog_category_slug": "wallpanels",
            "custom_product_type": "3D Panel Poster",
        },
        {
            "email": "vendor2@kolekcia.com",
            "password": "vendor12345",
            "name": "Sculpi",
            "slug": "sculpi",
            "catalog_category_slug": "figures",
            "custom_product_type": "3D Figure",
        },
    ],
}


class Command(BaseCommand):
    help = "Create or repair the default superadmin and vendor admin accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete-existing",
            action="store_true",
            help="Delete these three accounts first, then recreate them.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        emails = [ACCOUNTS["superadmin"]["email"], *[v["email"] for v in ACCOUNTS["vendors"]]]

        if options["delete_existing"]:
            Vendor.objects.filter(user__email__in=emails).delete()
            User.objects.filter(email__in=emails).delete()
            self.stdout.write(self.style.WARNING("Deleted existing default admin/vendor accounts."))

        super_cfg = ACCOUNTS["superadmin"]
        admin, _ = User.objects.update_or_create(
            email=super_cfg["email"],
            defaults={
                "name": super_cfg["name"],
                "role": "staff",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        admin.set_password(super_cfg["password"])
        admin.save(update_fields=["password", "name", "role", "is_staff", "is_superuser", "is_active"])
        self.stdout.write(self.style.SUCCESS(f"Superadmin ready: {admin.email}"))

        for cfg in ACCOUNTS["vendors"]:
            user, _ = User.objects.update_or_create(
                email=cfg["email"],
                defaults={
                    "name": cfg["name"],
                    "role": "staff",
                    "is_staff": False,
                    "is_superuser": False,
                    "is_active": True,
                },
            )
            user.set_password(cfg["password"])
            user.save(update_fields=["password", "name", "role", "is_staff", "is_superuser", "is_active"])

            vendor, _ = Vendor.objects.update_or_create(
                user=user,
                defaults={
                    "name": cfg["name"],
                    "slug": cfg["slug"],
                    "catalog_category_slug": cfg["catalog_category_slug"],
                    "custom_product_type": cfg["custom_product_type"],
                },
            )
            self.stdout.write(self.style.SUCCESS(f"Vendor admin ready: {user.email} -> {vendor.slug}"))

        self.stdout.write(self.style.SUCCESS("Default admin accounts are ready."))
