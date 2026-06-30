from django.db import migrations, models
from django.utils.text import slugify


def populate_product_slugs(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    seen = set()
    for product in Product.objects.all().order_by("id"):
        base = slugify(product.title) or f"product-{product.id}"
        candidate = base
        n = 1
        while candidate in seen or Product.objects.filter(slug=candidate).exclude(pk=product.pk).exists():
            candidate = f"{base}-{n}"
            n += 1
        seen.add(candidate)
        product.slug = candidate
        product.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0004_artist_vendor"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="slug",
            field=models.SlugField(blank=True, max_length=280, null=True),
        ),
        migrations.RunPython(populate_product_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="product",
            name="slug",
            field=models.SlugField(blank=True, max_length=280, unique=True),
        ),
    ]
