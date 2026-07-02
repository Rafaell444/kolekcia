from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        return response

    # Keep traceback in server logs for debugging unknown 500s.
    logger.exception("Unhandled API exception", exc_info=exc)

    detail = "An unexpected error occurred."
    if settings.DEBUG:
        detail = f"{detail} {exc.__class__.__name__}: {exc}"

    return Response({"detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
