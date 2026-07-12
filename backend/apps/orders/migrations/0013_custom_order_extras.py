from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0009_sizevariant_regional_prices_giftwrap_note"),
    ]

    operations = [
        migrations.AddField(
            model_name="customorder",
            name="cancel_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="customorder",
            name="currency",
            field=models.CharField(default="USD", max_length=10),
        ),
        migrations.AddField(
            model_name="customorder",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="customorder",
            name="payment_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="customorder",
            name="price",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="customorder",
            name="tracking_code",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AlterField(
            model_name="customorder",
            name="image_url",
            field=models.TextField(),
        ),
    ]
