from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("vendors", "0005_vendor_merchant_id"),
        ("orders", "0013_custom_order_extras"),
    ]

    operations = [
        migrations.CreateModel(
            name="VendorShippingOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("market", models.CharField(choices=[("GE", "Georgia"), ("US", "United States"), ("EU", "Europe"), ("GB", "United Kingdom")], max_length=5)),
                ("label", models.CharField(max_length=50)),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ("est_days_min", models.PositiveIntegerField(default=1)),
                ("est_days_max", models.PositiveIntegerField(default=5)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "vendor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shipping_options",
                        to="vendors.vendor",
                    ),
                ),
            ],
            options={
                "db_table": "vendor_shipping_options",
                "ordering": ["market", "sort_order"],
                "unique_together": {("vendor", "market", "label")},
            },
        ),
    ]
