import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0005_product_slug"),
        ("messaging", "0003_conversation_vendor"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="product",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="conversations", to="products.product"),
        ),
    ]
