from django.db import migrations, models


def clear_sculpi_product_fields(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    Product.objects.filter(
        models.Q(vendor__slug__in=("sculpi", "figure-studio"))
        | models.Q(vendor__user__email="vendor2@kolekcia.com")
    ).update(
        material="",
        material_ka="",
        product_details=[],
        product_details_ka=[],
    )


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0025_remove_artist_bio_ru_remove_artist_name_ru_and_more"),
    ]

    operations = [
        migrations.RunPython(clear_sculpi_product_fields, migrations.RunPython.noop),
    ]
