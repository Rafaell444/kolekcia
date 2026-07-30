from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cms", "0008_google_review_fields")]
    operations = [
        migrations.CreateModel(
            name="TrustBarItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.SlugField(unique=True)),
                ("title", models.CharField(max_length=120)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("icon", models.CharField(blank=True, max_length=30)),
                ("logos", models.JSONField(blank=True, default=list)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="FandomBrand",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("abbreviation", models.CharField(max_length=120)),
                ("background", models.CharField(default="#111111", max_length=20)),
                ("text_color", models.CharField(default="#ffffff", max_length=20)),
                ("link", models.CharField(blank=True, max_length=255)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
    ]
