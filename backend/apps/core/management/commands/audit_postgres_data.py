from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import models


class Command(BaseCommand):
    help = "Read-only audit of text data that SQLite accepts but PostgreSQL rejects."

    def handle(self, *args, **options):
        issues = []
        for model in apps.get_models():
            fields = [
                field for field in model._meta.concrete_fields
                if isinstance(field, (models.CharField, models.TextField))
            ]
            if not fields:
                continue
            counts = {field.name: [0, 0, 0] for field in fields}
            rows = model._base_manager.values_list(
                *(field.name for field in fields)
            ).iterator(chunk_size=1000)
            for row in rows:
                for field, value in zip(fields, row):
                    if value is None:
                        continue
                    value = str(value)
                    stats = counts[field.name]
                    if field.max_length and len(value) > field.max_length:
                        stats[0] += 1
                        stats[1] = max(stats[1], len(value))
                    if "\x00" in value:
                        stats[2] += 1
            for field in fields:
                oversized, longest, nul_count = counts[field.name]
                label = f"{model._meta.label}.{field.name}"
                if oversized:
                    issues.append(
                        f"{label}: {oversized} value(s) exceed max_length={field.max_length}; "
                        f"longest={longest}."
                    )
                if nul_count:
                    issues.append(f"{label}: {nul_count} value(s) contain a NUL character.")
        for issue in issues:
            self.stderr.write(issue)
        if issues:
            raise CommandError(
                "PostgreSQL text-data audit failed. Resolve these fields before exporting; "
                "no data was changed."
            )
        self.stdout.write(self.style.SUCCESS("PostgreSQL text-data audit passed. No data changed."))
