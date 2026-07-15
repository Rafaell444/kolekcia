from .base import *  # noqa

DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

CORS_ALLOW_ALL_ORIGINS = True

# Disable rate throttling in local dev so 429s don't appear during development
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []  # type: ignore[index]
