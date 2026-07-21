from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa

DEBUG = False

if str(SECRET_KEY).startswith("django-insecure-"):
    raise ImproperlyConfigured(
        "SECRET_KEY must be a strong random value in production "
        "(DEBUG=False). Do not use a django-insecure-* key."
    )

# PythonAnywhere (and similar reverse proxies) terminate TLS in front of Django.
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
