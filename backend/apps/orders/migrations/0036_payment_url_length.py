from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0035_order_refunded_total_orderitem_refunded_quantity_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="paymentsession", name="payment_url",
            field=models.URLField(blank=True, max_length=2048),
        ),
        migrations.AlterField(
            model_name="customorder", name="payment_url",
            field=models.URLField(blank=True, max_length=2048),
        ),
    ]
