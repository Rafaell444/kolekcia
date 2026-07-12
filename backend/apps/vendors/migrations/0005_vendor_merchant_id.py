from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vendors", "0004_vendor_social_youtube"),
    ]

    operations = [
        migrations.AddField(
            model_name="vendor",
            name="merchant_id",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
