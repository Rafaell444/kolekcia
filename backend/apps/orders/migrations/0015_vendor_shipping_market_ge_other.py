from django.db import migrations, models


def migrate_markets_to_ge_other(apps, schema_editor):
    VendorShippingOption = apps.get_model("orders", "VendorShippingOption")
    VendorShippingOption.objects.filter(market__in=["US", "EU", "GB"]).update(market="OTHER")


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0014_vendor_shipping_option"),
    ]

    operations = [
        migrations.RunPython(migrate_markets_to_ge_other, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="vendorshippingoption",
            name="market",
            field=models.CharField(
                choices=[("GE", "Georgian"), ("OTHER", "Other")],
                max_length=10,
            ),
        ),
    ]
