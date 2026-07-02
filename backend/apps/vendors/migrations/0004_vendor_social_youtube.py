from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vendors", "0003_vendor_storefront"),
    ]

    operations = [
        migrations.AddField(
            model_name="vendor",
            name="social_youtube",
            field=models.URLField(blank=True),
        ),
    ]
