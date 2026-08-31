from django.db import migrations


def seed_missing_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("emails", "EmailTemplate")
    from apps.emails.default_templates import get_default_templates

    for payload in get_default_templates():
        defaults = {key: value for key, value in payload.items() if key != "vendor"}
        EmailTemplate.objects.get_or_create(
            vendor=None,
            event_key=payload["event_key"],
            defaults=defaults,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("emails", "0005_seed_auction_second_chance_template"),
    ]

    operations = [
        migrations.RunPython(seed_missing_templates, noop_reverse),
    ]
