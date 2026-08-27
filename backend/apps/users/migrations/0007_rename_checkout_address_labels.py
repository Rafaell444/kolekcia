from django.db import migrations


def rename_checkout_labels(apps, schema_editor):
    Address = apps.get_model("users", "Address")
    for address in Address.objects.filter(label__iexact="Checkout"):
        address.label = (address.city or address.state or "Saved address")[:50]
        address.save(update_fields=["label"])


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0006_delete_paymentmethod"),
    ]

    operations = [
        migrations.RunPython(rename_checkout_labels, migrations.RunPython.noop),
    ]
