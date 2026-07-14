from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0016_add_sizevariant_images_m2m'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='processing_time_label',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='sizevariant',
            name='stock',
            field=models.IntegerField(blank=True, default=None, null=True),
        ),
    ]
