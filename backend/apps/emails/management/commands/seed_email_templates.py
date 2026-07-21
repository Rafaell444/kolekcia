from django.core.management.base import BaseCommand

from apps.emails.default_templates import install_default_templates


class Command(BaseCommand):
    help = "Install branded platform-wide email templates for all event types"

    def add_arguments(self, parser):
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Replace existing platform templates with the brand defaults",
        )

    def handle(self, *args, **options):
        result = install_default_templates(overwrite=options["overwrite"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Email templates: created={result['created']} "
                f"updated={result['updated']} skipped={result['skipped']}"
            )
        )
