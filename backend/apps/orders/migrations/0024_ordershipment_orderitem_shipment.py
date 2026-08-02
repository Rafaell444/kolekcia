import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0023_processingoption_label_en_processingoption_label_ka_and_more'),
        ('vendors', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderShipment',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_type', models.CharField(max_length=50)),
                ('delivery_label', models.CharField(max_length=100)),
                ('delivery_price', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('tracking_code', models.CharField(blank=True, max_length=100)),
                ('shipped_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[('processing', 'Processing'), ('shipped', 'Shipped'), ('delivered', 'Delivered')],
                    default='processing',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='shipments',
                    to='orders.order',
                )),
                ('vendor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='order_shipments',
                    to='vendors.vendor',
                )),
            ],
            options={
                'db_table': 'order_shipments',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddField(
            model_name='orderitem',
            name='shipment',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='items',
                to='orders.ordershipment',
            ),
        ),
    ]
