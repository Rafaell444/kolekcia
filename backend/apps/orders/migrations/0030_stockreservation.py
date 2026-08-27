import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0029_orderitem_size_variant_orderitem_variant_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="StockReservation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.PositiveIntegerField()),
                ("status", models.CharField(choices=[("active", "Active"), ("finalized", "Finalized"), ("released", "Released")], default="active", max_length=20)),
                ("expires_at", models.DateTimeField()),
                ("finalized_at", models.DateTimeField(blank=True, null=True)),
                ("released_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stock_reservations", to="orders.order")),
                ("order_item", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="stock_reservation", to="orders.orderitem")),
                ("size_variant", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="stock_reservations", to="products.sizevariant")),
                ("variant", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="stock_reservations", to="products.productvariant")),
            ],
            options={"db_table": "stock_reservations"},
        ),
        migrations.AddIndex(model_name="stockreservation", index=models.Index(fields=["variant", "status", "expires_at"], name="stock_reser_variant_06c31e_idx")),
        migrations.AddIndex(model_name="stockreservation", index=models.Index(fields=["size_variant", "status", "expires_at"], name="stock_reser_size_va_2bd867_idx")),
        migrations.AddIndex(model_name="stockreservation", index=models.Index(fields=["order", "status"], name="stock_reser_order_i_f5f13e_idx")),
    ]
