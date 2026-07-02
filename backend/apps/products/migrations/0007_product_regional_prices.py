from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0006_product_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="regional_prices",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
