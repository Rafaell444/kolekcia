from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0005_customorder_product_type_customorder_vendor"),
    ]

    operations = [
        migrations.CreateModel(
            name="DeliveryOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.CharField(max_length=20, unique=True)),
                ("label", models.CharField(max_length=50)),
                ("price_gel", models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ("price_usd", models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ("est_days_min", models.PositiveIntegerField(default=1)),
                ("est_days_max", models.PositiveIntegerField(default=5)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"db_table": "delivery_options", "ordering": ["sort_order"]},
        ),
        migrations.AddField(
            model_name="cartitem",
            name="gift_wrap",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="cartitem",
            name="gift_wrap_price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
        migrations.AddField(
            model_name="cartitem",
            name="delivery_type",
            field=models.CharField(default="standard", max_length=20),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_type",
            field=models.CharField(default="standard", max_length=20),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
        migrations.AddField(
            model_name="order",
            name="gift_wrap_total",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
        migrations.AddField(
            model_name="order",
            name="currency",
            field=models.CharField(default="USD", max_length=10),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="gift_wrap",
            field=models.BooleanField(default=False),
        ),
    ]
