"""PostgreSQL-backed CI settings.

Normal local commands use local.py and SQLite. This module keeps production's
database validation while disabling browser-facing security redirects and
external side effects for integration tests.
"""

from .production import *  # noqa

DEBUG = True
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER = True
KEEPZ_ENABLED = False
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
