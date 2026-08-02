from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0024_ordershipment_orderitem_shipment'),
    ]

    operations = [
        migrations.AddField(
            model_name='vendorshippingoption',
            name='is_express',
            field=models.BooleanField(
                default=False,
                help_text='Express/fast shipping. In GE market, only shown if all vendor items are ready to ship.',
            ),
        ),
    ]
