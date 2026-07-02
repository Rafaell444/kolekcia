from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0005_product_slug"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("paused", "Paused"), ("sold", "Sold")],
                default="active",
                max_length=10,
            ),
        ),
    ]

