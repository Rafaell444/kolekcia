from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("products", "0018_category_meta_description_and_more")]
    operations = [
        migrations.AddField("artist", "name_ka", models.CharField(blank=True, max_length=255, null=True)),
        migrations.AddField("artist", "name_ru", models.CharField(blank=True, max_length=255, null=True)),
        migrations.AddField("artist", "bio_ka", models.TextField(blank=True, null=True)),
        migrations.AddField("artist", "bio_ru", models.TextField(blank=True, null=True)),
        migrations.AddField("postersize", "label_ka", models.CharField(blank=True, max_length=50, null=True)),
        migrations.AddField("postersize", "label_ru", models.CharField(blank=True, max_length=50, null=True)),
        migrations.AddField("posterfinish", "label_ka", models.CharField(blank=True, max_length=50, null=True)),
        migrations.AddField("posterfinish", "label_ru", models.CharField(blank=True, max_length=50, null=True)),
        migrations.AddField("posterframe", "label_ka", models.CharField(blank=True, max_length=50, null=True)),
        migrations.AddField("posterframe", "label_ru", models.CharField(blank=True, max_length=50, null=True)),
        migrations.AddField("sizevariant", "label_ka", models.CharField(blank=True, max_length=50, null=True)),
        migrations.AddField("sizevariant", "label_ru", models.CharField(blank=True, max_length=50, null=True)),
    ]
