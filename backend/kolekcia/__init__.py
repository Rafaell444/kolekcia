try:
    from .celery import app as celery_app
except ImportError:  # Celery is optional so the site still boots before deps are installed.
    celery_app = None

__all__ = ("celery_app",)
