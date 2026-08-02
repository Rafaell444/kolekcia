from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('promo', '0004_creator_vouchers'),
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='promocode',
            name='products',
            field=models.ManyToManyField(
                blank=True,
                help_text='Limit to these products. Leave empty for all products.',
                related_name='promo_codes',
                to='products.product',
            ),
        ),
        migrations.AddField(
            model_name='promocode',
            name='categories',
            field=models.ManyToManyField(
                blank=True,
                help_text='Limit to products in these categories. Leave empty for all.',
                related_name='promo_codes',
                to='products.category',
            ),
        ),
    ]
