from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0030_stockreservation"),
    ]

    operations = [
        migrations.AddField(
            model_name="orderitem",
            name="gift_wrap_price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="tier_discount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="voucher_discount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
