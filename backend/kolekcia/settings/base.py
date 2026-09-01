from pathlib import Path
from corsheaders.defaults import default_headers
from datetime import timedelta
import environ
import os
from django.core.exceptions import ImproperlyConfigured

# Verify TLS against the operating system's trust store rather than a bundled
# CA list. Networks that inspect TLS (corporate proxies, antivirus HTTPS
# scanning) present certificates signed by a root that only exists in the OS
# store, so pinning certifi here breaks every outbound HTTPS call — Keepz,
# Google's OAuth certs, and S3 among them. The OS store is also correct in
# production, where it holds the standard public roots.
try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    # Fall back to certifi so a machine without truststore still has a CA set.
    import certifi

    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    DATABASE_URL=(str, f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000"]),
    CSRF_TRUSTED_ORIGINS=(list, []),
    SECRET_KEY=(str, "django-insecure-change-me"),
    FRONTEND_URL=(str, "http://localhost:3000"),
    BACKEND_PUBLIC_URL=(str, "http://127.0.0.1:8000"),
    GOOGLE_CLIENT_ID=(str, ""),
    GOOGLE_REVIEW_URL=(str, ""),
    GOOGLE_REVIEWS_API_URL=(str, ""),
    GOOGLE_REVIEWS_API_TOKEN=(str, ""),
    KEEPZ_ENABLED=(bool, False),
    KEEPZ_ENV=(str, "test"),
    KEEPZ_IDENTIFIER=(str, ""),
    KEEPZ_INTEGRATOR_ID=(str, ""),
    KEEPZ_RECEIVER_ID=(str, ""),
    KEEPZ_FOREIGN_RECEIVER_ID=(str, ""),
    KEEPZ_RECEIVER_TYPE=(str, "BRANCH"),
    KEEPZ_SPLIT_ENABLED=(bool, False),
    KEEPZ_VENDOR_RECEIVER_TYPE=(str, "BRANCH"),
    KEEPZ_PUBLIC_KEY=(str, ""),
    KEEPZ_PRIVATE_KEY=(str, ""),
    KEEPZ_DIRECT_LINK_PROVIDER=(str, ""),
    KEEPZ_COMMISSION_TYPE=(str, ""),
    KEEPZ_DYNAMIC_URLS=(bool, False),
)

environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")
FRONTEND_URL = env("FRONTEND_URL")
BACKEND_PUBLIC_URL = env("BACKEND_PUBLIC_URL")
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID")
GOOGLE_REVIEW_URL = env("GOOGLE_REVIEW_URL")
GOOGLE_REVIEWS_API_URL = env("GOOGLE_REVIEWS_API_URL")
GOOGLE_REVIEWS_API_TOKEN = env("GOOGLE_REVIEWS_API_TOKEN")
KEEPZ_ENABLED = env("KEEPZ_ENABLED")
KEEPZ_ENV = env("KEEPZ_ENV")
KEEPZ_IDENTIFIER = env("KEEPZ_IDENTIFIER")
KEEPZ_INTEGRATOR_ID = env("KEEPZ_INTEGRATOR_ID")
KEEPZ_RECEIVER_ID = env("KEEPZ_RECEIVER_ID")
KEEPZ_FOREIGN_RECEIVER_ID = env("KEEPZ_FOREIGN_RECEIVER_ID")
KEEPZ_RECEIVER_TYPE = env("KEEPZ_RECEIVER_TYPE")
KEEPZ_SPLIT_ENABLED = env("KEEPZ_SPLIT_ENABLED")
KEEPZ_VENDOR_RECEIVER_TYPE = env("KEEPZ_VENDOR_RECEIVER_TYPE")

# How long a customer has to complete payment at Keepz. Sent as `validUntil`
# only when KEEPZ_ORDER_EXPIRY_ENABLED is on, which Keepz must grant per
# integrator (they return error 6032 otherwise).
KEEPZ_PAYMENT_WINDOW_MINUTES = env("KEEPZ_PAYMENT_WINDOW_MINUTES", default=5)
KEEPZ_ORDER_EXPIRY_ENABLED = env("KEEPZ_ORDER_EXPIRY_ENABLED", default=False)
# Stock must stay reserved slightly longer than the payment window, so network
# latency and clock drift between us and Keepz cannot let a paid order find its
# inventory already resold.
PAYMENT_STOCK_RESERVATION_BUFFER_MINUTES = env(
    "PAYMENT_STOCK_RESERVATION_BUFFER_MINUTES", default=2
)
PAYMENT_STOCK_RESERVATION_MINUTES = env(
    "PAYMENT_STOCK_RESERVATION_MINUTES",
    default=KEEPZ_PAYMENT_WINDOW_MINUTES + PAYMENT_STOCK_RESERVATION_BUFFER_MINUTES,
)
KEEPZ_PUBLIC_KEY = env("KEEPZ_PUBLIC_KEY")
KEEPZ_PRIVATE_KEY = env("KEEPZ_PRIVATE_KEY")
KEEPZ_DIRECT_LINK_PROVIDER = env("KEEPZ_DIRECT_LINK_PROVIDER")
KEEPZ_COMMISSION_TYPE = env("KEEPZ_COMMISSION_TYPE")
KEEPZ_DYNAMIC_URLS = env("KEEPZ_DYNAMIC_URLS")

# Reject insecure default keys when running with DEBUG=False (production).
if not DEBUG and str(SECRET_KEY).startswith("django-insecure-"):
    raise ImproperlyConfigured(
        "SECRET_KEY must be a strong random value in production "
        "(DEBUG=False). Do not use a django-insecure-* key."
    )

DJANGO_APPS = [
    "daphne",  # Must be before staticfiles to patch runserver for ASGI/WebSocket support
    "modeltranslation",  # Must precede django.contrib.admin per docs
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
]

LOCAL_APPS = [
    "apps.core",
    "apps.users",
    "apps.vendors",
    "apps.products",
    "apps.orders",
    "apps.auctions",
    "apps.gamification",
    "apps.promo",
    "apps.creators",
    "apps.cms",
    "apps.blog",
    "apps.referrals",
    "apps.messaging",
    "apps.newsletter",
    "apps.contact",
    "apps.tenants",
    "apps.emails",
    "apps.admin_api",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.APILocaleMiddleware",
]

ROOT_URLCONF = "kolekcia.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "kolekcia.wsgi.application"
ASGI_APPLICATION = "kolekcia.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

_redis_url = env("REDIS_URL", default="")
if _redis_url:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [_redis_url]},
        },
    }
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _redis_url,
        }
    }

CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=_redis_url or "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
# Payment reconciliation must never run twice concurrently for the same session.
CELERY_TASK_DEFAULT_QUEUE = "default"
# Run tasks inline when no broker is reachable (tests, local dev without Redis).
CELERY_TASK_ALWAYS_EAGER = env("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = True

KEEPZ_RECONCILE_INTERVAL_SECONDS = env("KEEPZ_RECONCILE_INTERVAL_SECONDS", default=300)
KEEPZ_RECONCILE_MIN_AGE_SECONDS = env("KEEPZ_RECONCILE_MIN_AGE_SECONDS", default=300)
KEEPZ_RECONCILE_MAX_AGE_HOURS = env("KEEPZ_RECONCILE_MAX_AGE_HOURS", default=24)
KEEPZ_RECONCILE_BATCH_LIMIT = env("KEEPZ_RECONCILE_BATCH_LIMIT", default=25)
# Reject fulfillment when Keepz omits amount/currency from the verified status.
KEEPZ_REQUIRE_AMOUNT_VERIFICATION = env("KEEPZ_REQUIRE_AMOUNT_VERIFICATION", default=False)

CELERY_BEAT_SCHEDULE = {
    "reconcile-keepz-payments": {
        "task": "apps.orders.tasks.reconcile_keepz_payments",
        "schedule": float(KEEPZ_RECONCILE_INTERVAL_SECONDS),
        "options": {"expires": float(KEEPZ_RECONCILE_INTERVAL_SECONDS) - 10},
    },
    "expire-stale-keepz-payments": {
        "task": "apps.orders.tasks.expire_stale_keepz_payments",
        "schedule": 900.0,
        "options": {"expires": 600.0},
    },
}

# Shared settings retain a SQLite default for management commands and local
# tooling. local.py explicitly selects SQLite; production.py replaces this
# configuration and refuses to start unless DATABASE_URL is PostgreSQL.
DATABASES = {"default": env.db("DATABASE_URL")}

AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {
        "NAME": "apps.users.password_validation.KoleqciaPasswordValidator",
        "OPTIONS": {"min_length": 8},
    },
]

LANGUAGE_CODE = "en"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

LANGUAGES = [
    ("en", "English"),
    ("ka", "Georgian"),
]

MODELTRANSLATION_DEFAULT_LANGUAGE = "en"
MODELTRANSLATION_LANGUAGES = ("en", "ka")
# Georgian storefront content falls back to English until a translation is added.
MODELTRANSLATION_ENABLE_FALLBACKS = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "1000/minute",      # Public browsing (was 500/day - way too low)
        "user": "2000/minute",      # Authenticated users
        "auth": "20/min",           # Login/register attempts
        "forgot_password": "10/hour",  # IP backup; per-email quota is separate
        "admin_auth": "10/min",
        "contact": "10/hour",
        "newsletter": "20/hour",
        "checkout": "60/hour",
        "promo_apply": "30/hour",
        "creator_apply": "5/hour",
        "xp_award": "30/hour",
        "bid": "60/hour",
    },
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "EXCEPTION_HANDLER": "kolekcia.exceptions.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=2),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_HEADERS = (*default_headers, "idempotency-key", "x-device-id")
CORS_ALLOW_CREDENTIALS = True

_csrf_origins = env("CSRF_TRUSTED_ORIGINS")
CSRF_TRUSTED_ORIGINS = _csrf_origins if _csrf_origins else CORS_ALLOWED_ORIGINS

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="apps.emails.backends.TrustedSMTPEmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
# Google Workspace aliases (From headers). SMTP auth still uses EMAIL_HOST_USER.
EMAIL_FROM_ACCOUNTS = env("EMAIL_FROM_ACCOUNTS", default="accounts@koleqcia.com")
EMAIL_FROM_ORDERS = env("EMAIL_FROM_ORDERS", default="orders@koleqcia.com")
EMAIL_FROM_AUCTIONS = env("EMAIL_FROM_AUCTIONS", default="auctions@koleqcia.com")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="orders@koleqcia.com")

# Forgot-password: max requests per email address within the window
FORGOT_PASSWORD_LIMIT = env.int("FORGOT_PASSWORD_LIMIT", default=5)
FORGOT_PASSWORD_WINDOW_SECONDS = env.int("FORGOT_PASSWORD_WINDOW_SECONDS", default=3600)
