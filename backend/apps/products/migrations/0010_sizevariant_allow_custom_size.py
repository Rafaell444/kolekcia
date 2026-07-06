from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0009_product_image_video_support'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='allow_custom_size',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='product',
            name='categories',
            field=models.ManyToManyField(blank=True, related_name='all_products', to='products.category'),
        ),
        migrations.CreateModel(
            name='SizeVariant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=50)),
                ('price_usd', models.DecimalField(decimal_places=2, max_digits=10)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='size_variants', to='products.product')),
            ],
            options={
                'db_table': 'size_variants',
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]
