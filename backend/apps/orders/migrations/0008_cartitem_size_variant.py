from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0007_processing_option_cartitem'),
        ('products', '0010_sizevariant_allow_custom_size'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='cartitem',
            unique_together=set(),
        ),
        migrations.AlterField(
            model_name='cartitem',
            name='variant',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='products.productvariant'),
        ),
        migrations.AddField(
            model_name='cartitem',
            name='size_variant',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cart_items', to='products.sizevariant'),
        ),
    ]
