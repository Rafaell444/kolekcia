from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0019_processing_fee_snapshots"),
    ]

    operations = [
        migrations.AddField(
            model_name="cartitem",
            name="unit_price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="cartitem",
            name="currency",
            field=models.CharField(default="USD", max_length=10),
        ),
    ]
