from django.db import migrations


def backfill_processing_vendor(apps, schema_editor):
    ProcessingOption = apps.get_model("orders", "ProcessingOption")
    Vendor = apps.get_model("vendors", "Vendor")
    vendor = Vendor.objects.filter(slug="panel-studio").first()
    if vendor:
        ProcessingOption.objects.filter(vendor__isnull=True).update(vendor=vendor)


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0016_vendor_ops_and_page_sections"),
    ]

    operations = [
        migrations.RunPython(backfill_processing_vendor, migrations.RunPython.noop),
    ]
