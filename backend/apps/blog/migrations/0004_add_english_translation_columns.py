from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("blog", "0003_multilingual_content")]
    operations = [
        migrations.AddField("blogpost", "title_en", models.CharField(blank=True, max_length=255, null=True)),
        migrations.AddField("blogpost", "excerpt_en", models.TextField(blank=True, null=True)),
        migrations.AddField("blogpost", "content_en", models.TextField(blank=True, null=True)),
    ]
