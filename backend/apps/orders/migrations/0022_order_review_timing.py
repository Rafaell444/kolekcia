from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("orders", "0021_alter_order_status")]
    operations = [
        migrations.AddField("order", "shipped_at", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("order", "review_requested_at", models.DateTimeField(blank=True, null=True)),
    ]
