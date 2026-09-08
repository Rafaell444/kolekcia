from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0026_clear_sculpi_material_and_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="menu_image_url",
            field=models.URLField(blank=True),
        ),
    ]
