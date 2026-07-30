from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cms", "0007_alter_announcementbar_messages_en_and_more")]
    operations = [
        migrations.AddField("homepagereview", "google_review_id", models.CharField(blank=True, max_length=255, null=True, unique=True)),
        migrations.AddField("homepagereview", "google_review_url", models.URLField(blank=True, default="")),
    ]
