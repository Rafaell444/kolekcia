from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0017_backfill_processing_vendor"),
    ]

    operations = [
        migrations.AddField(
            model_name="processingoption",
            name="is_included",
            field=models.BooleanField(default=False),
        ),
    ]
