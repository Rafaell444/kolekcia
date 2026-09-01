import json
from collections import Counter
from pathlib import Path

from django.apps import apps
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = "Import an ID-preserving JSON snapshot into a fresh, migrated PostgreSQL database."

    def add_arguments(self, parser):
        parser.add_argument("snapshot", type=Path)

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("The import destination must be PostgreSQL, not the local SQLite database.")
        path = options["snapshot"].resolve()
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise CommandError("Could not read the UTF-8 JSON snapshot.") from exc
        if not isinstance(records, list) or not records:
            raise CommandError("The snapshot must contain a non-empty list of records.")

        managed_defaults = {"contenttypes.contenttype", "auth.permission"}
        seen = set()
        expected = Counter()
        for record in records:
            if not isinstance(record, dict) or record.get("pk") is None:
                raise CommandError("Every record must retain its primary key. Do not use --natural-primary.")
            label = str(record.get("model", "")).lower()
            try:
                apps.get_model(label)
            except (LookupError, ValueError) as exc:
                raise CommandError(f"Unknown snapshot model: {label}.") from exc
            if label in managed_defaults:
                raise CommandError("Exclude contenttypes and auth.permission when exporting.")
            key = (label, str(record["pk"]))
            if key in seen:
                raise CommandError(f"Duplicate primary key in snapshot model {label}.")
            seen.add(key)
            expected[label] += 1

        executor = MigrationExecutor(connection)
        if executor.migration_plan(executor.loader.graph.leaf_nodes()):
            raise CommandError("Apply all migrations to the fresh destination before importing.")

        with transaction.atomic():
            models = list(apps.get_models())
            for model in models:
                label = model._meta.label_lower
                if label in managed_defaults or label == "emails.emailtemplate":
                    continue
                if model._base_manager.exists():
                    raise CommandError(
                        f"Destination is not fresh: {label} contains data. Nothing was changed."
                    )
            # Fresh migrations seed templates. Source IDs and template choices
            # must win, and a failed import must restore the original seeds.
            apps.get_model("emails", "EmailTemplate").objects.all().delete()
            call_command("loaddata", str(path), verbosity=0)
            for model in models:
                label = model._meta.label_lower
                if label not in managed_defaults:
                    if model._base_manager.count() != expected[label]:
                        raise CommandError(f"Imported record count does not match for {label}; rolled back.")
        self.stdout.write(self.style.SUCCESS(
            f"Imported and verified {len(records)} records. Primary keys preserved."
        ))
