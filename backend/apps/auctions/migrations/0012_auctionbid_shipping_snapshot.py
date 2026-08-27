from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("auctions", "0011_auctionchatmessage_deleted_at_and_more"),
    ]

    operations = [
        migrations.AddField(model_name="auctionbid", name="shipping_name", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="auctionbid", name="shipping_line1", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="auctionbid", name="shipping_city", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="auctionbid", name="shipping_state", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="auctionbid", name="shipping_zip", field=models.CharField(blank=True, max_length=20)),
        migrations.AddField(model_name="auctionbid", name="shipping_country", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="auctionbid", name="shipping_email", field=models.EmailField(blank=True, max_length=254)),
        migrations.AddField(model_name="auctionbid", name="shipping_phone", field=models.CharField(blank=True, max_length=30)),
    ]
