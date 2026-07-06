from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0007_product_regional_prices"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="product",
            name="material",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
