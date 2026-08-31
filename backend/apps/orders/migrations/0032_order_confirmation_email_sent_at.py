from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0031_orderitem_discount_and_gift_wrap_snapshots"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="confirmation_email_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
