import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa

DEBUG = False

if str(SECRET_KEY).startswith("django-insecure-"):
    raise ImproperlyConfigured(
        "SECRET_KEY must be a strong random value in production "
        "(DEBUG=False). Do not use a django-insecure-* key."
    )

# Production must never silently fall back to the local SQLite database. AWS
# should provide a PostgreSQL URL from Secrets Manager, Parameter Store, or the
# process environment.
_database_url = os.environ.get("DATABASE_URL", "").strip()
if not _database_url:
    raise ImproperlyConfigured(
        "DATABASE_URL is required in production and must point to PostgreSQL."
    )

DATABASES = {"default": env.db_url_config(_database_url)}
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
    raise ImproperlyConfigured(
        "Production requires PostgreSQL. DATABASE_URL must start with "
        "postgresql:// or postgres://."
    )

# The production app runs under ASGI. Django recommends disabling its own
# persistent connections there; RDS Proxy or another external pool should own
# connection reuse instead.
DATABASES["default"]["CONN_MAX_AGE"] = env("DB_CONN_MAX_AGE", default=0)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = env(
    "DB_CONN_HEALTH_CHECKS", default=True
)
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = env(
    "DB_DISABLE_SERVER_SIDE_CURSORS", default=False
)

_database_options = DATABASES["default"].setdefault("OPTIONS", {})
_database_options.setdefault("connect_timeout", env("DB_CONNECT_TIMEOUT", default=10))
_database_options.setdefault(
    "application_name", env("DB_APPLICATION_NAME", default="koleqcia-api")
)

# RDS accepts encrypted connections. Use verify-full with the AWS RDS CA bundle
# when available; `require` is the secure baseline for environments where the
# bundle has not yet been mounted.
_sslmode = env("DB_SSLMODE", default="require").strip().lower()
if _sslmode not in {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}:
    raise ImproperlyConfigured("DB_SSLMODE is not a valid PostgreSQL sslmode value.")
_database_options.setdefault("sslmode", _sslmode)

_sslrootcert = env("DB_SSLROOTCERT", default="").strip()
if _sslrootcert:
    _database_options.setdefault("sslrootcert", _sslrootcert)
elif _sslmode in {"verify-ca", "verify-full"}:
    raise ImproperlyConfigured(
        "DB_SSLROOTCERT is required for DB_SSLMODE=verify-ca or verify-full."
    )

# AWS load balancers and similar reverse proxies terminate TLS in front of Django.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
