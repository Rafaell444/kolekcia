from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0011_sizevariant_regional_prices_giftwrap_note"),
    ]

    operations = [
        migrations.AddField(
            model_name="sizevariant",
            name="sale_price_usd",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="sizevariant",
            name="sale_price_gel",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
