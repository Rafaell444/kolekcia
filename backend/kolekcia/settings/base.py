from pathlib import Path
from corsheaders.defaults import default_headers
from datetime import timedelta
import environ
import os
import certifi
from django.core.exceptions import ImproperlyConfigured

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
