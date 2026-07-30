from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("blog", "0002_content_blocks")]
    operations = [
        migrations.AddField("blogpost", "title_ka", models.CharField(blank=True, max_length=255, null=True)),
        migrations.AddField("blogpost", "title_ru", models.CharField(blank=True, max_length=255, null=True)),
        migrations.AddField("blogpost", "excerpt_ka", models.TextField(blank=True, null=True)),
        migrations.AddField("blogpost", "excerpt_ru", models.TextField(blank=True, null=True)),
        migrations.AddField("blogpost", "content_ka", models.TextField(blank=True, null=True)),
        migrations.AddField("blogpost", "content_ru", models.TextField(blank=True, null=True)),
    ]
