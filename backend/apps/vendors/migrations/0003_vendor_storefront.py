from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vendors", "0002_vendor_custom_cover_url_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="vendor",
            name="banner_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="vendor",
            name="catalog_category_slug",
            field=models.SlugField(blank=True, help_text="Category slug this vendor owns (e.g. figures, wallpanels)"),
        ),
        migrations.AddField(
            model_name="vendor",
            name="social_website",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="vendor",
            name="social_instagram",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="vendor",
            name="social_facebook",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="vendor",
            name="social_twitter",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="vendor",
            name="social_tiktok",
            field=models.URLField(blank=True),
        ),
    ]
