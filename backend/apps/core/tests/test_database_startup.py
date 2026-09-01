import os
from pathlib import Path
import subprocess
import sys

from django.test import SimpleTestCase


class DatabaseStartupTests(SimpleTestCase):
    def environment(self):
        env = os.environ.copy()
        env.pop("DJANGO_SETTINGS_MODULE", None)
        env.update({
            "PYTHONDONTWRITEBYTECODE": "1",
            "SECRET_KEY": "startup-tests-only-strong-key-not-for-production-0123456789",
            "DEBUG": "False",
            "DATABASE_URL": "sqlite:///:memory:",
        })
        return env

    def test_standalone_entrypoints_reject_sqlite_by_default(self):
        for module in ["kolekcia.asgi", "kolekcia.wsgi", "kolekcia.celery"]:
            with self.subTest(module=module):
                result = subprocess.run(
                    [sys.executable, "-c", (
                        f"import {module}; from django.conf import settings; "
                        "print(settings.DATABASES['default']['ENGINE'])"
                    )],
                    cwd=Path(__file__).resolve().parents[3],
                    env=self.environment(), capture_output=True, text=True, timeout=30,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Production requires PostgreSQL", result.stderr)

    def test_manage_py_still_defaults_to_local_sqlite(self):
        backend = Path(__file__).resolve().parents[3]
        result = subprocess.run(
            [sys.executable, str(backend / "manage.py"), "shell", "-c", (
                "from django.conf import settings; "
                "print(settings.DATABASES['default']['ENGINE'])"
            )],
            cwd=backend,
            env=self.environment(), capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("django.db.backends.sqlite3", result.stdout)
