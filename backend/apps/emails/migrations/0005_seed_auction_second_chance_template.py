from django.db import migrations


def seed_template(apps, schema_editor):
    EmailTemplate = apps.get_model("emails", "EmailTemplate")
    from apps.emails.default_templates import auction_second_chance_html

    EmailTemplate.objects.update_or_create(
        vendor=None,
        event_key="auction_second_chance",
        defaults={
            "name": "Auction Replacement Winner",
            "subject": "You can now claim {{auction_title}}",
            "html_body": auction_second_chance_html(),
            "design_json": {},
            "variables": [
                "winner_name", "auction_title", "winning_amount", "admin_note", "payment_link"
            ],
            "is_active": True,
        },
    )


def remove_template(apps, schema_editor):
    EmailTemplate = apps.get_model("emails", "EmailTemplate")
    EmailTemplate.objects.filter(
        vendor__isnull=True,
        event_key="auction_second_chance",
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("emails", "0004_alter_emailtemplate_event_key")]

    operations = [migrations.RunPython(seed_template, remove_template)]
