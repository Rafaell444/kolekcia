from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0023_product_processing_options_product_product_details_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="sizevariant",
            name="is_ready_to_ship",
            field=models.BooleanField(
                default=False,
                help_text="Pre-made unit in stock. When stock depletes to 0, product is still orderable (made to order).",
            ),
        ),
    ]
