from django.db import migrations


def normalize_default_vendor_identities(apps, schema_editor):
    Vendor = apps.get_model("vendors", "Vendor")
    identities = (
        ("vendor1@kolekcia.com", "MangaMoon", "mangamoon", "wallpanels"),
        ("vendor2@kolekcia.com", "Sculpi", "sculpi", "figures"),
    )
    for email, name, slug, category_slug in identities:
        vendor = Vendor.objects.filter(user__email=email).first()
        if not vendor:
            continue
        vendor.name = name
        vendor.catalog_category_slug = category_slug
        if not Vendor.objects.filter(slug=slug).exclude(pk=vendor.pk).exists():
            vendor.slug = slug
        vendor.save(update_fields=("name", "slug", "catalog_category_slug"))


class Migration(migrations.Migration):
    dependencies = [
        ("vendors", "0008_remove_vendor_description_ru_and_more"),
    ]

    operations = [
        migrations.RunPython(normalize_default_vendor_identities, migrations.RunPython.noop),
    ]
