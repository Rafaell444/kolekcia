"""Shared upload validation for image (and optional document) uploads."""

from __future__ import annotations

import os

from rest_framework import status
from rest_framework.response import Response

ALLOWED_IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif"})
ALLOWED_IMAGE_CONTENT_PREFIX = "image/"
# Explicit denylist for common dangerous types (defense in depth beyond allowlist).
BLOCKED_EXTENSIONS = frozenset({
    ".html", ".htm", ".svg", ".exe", ".js", ".mjs", ".php", ".py",
    ".sh", ".bat", ".cmd", ".ps1", ".aspx", ".jsp", ".cgi", ".wasm",
})
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def validate_image_upload(uploaded_file, *, max_bytes: int = DEFAULT_MAX_UPLOAD_BYTES) -> Response | None:
    """
    Validate an uploaded image file.

    Returns a DRF Response on failure, or None if the file is acceptable.
    """
    if not uploaded_file:
        return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

    name = getattr(uploaded_file, "name", "") or ""
    ext = os.path.splitext(name)[1].lower()

    if ext in BLOCKED_EXTENSIONS:
        return Response(
            {"detail": f"File type '{ext}' is not allowed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return Response(
            {
                "detail": (
                    "Only image files are allowed "
                    f"({', '.join(sorted(e.lstrip('.') for e in ALLOWED_IMAGE_EXTENSIONS))})."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    content_type = (getattr(uploaded_file, "content_type", None) or "").lower()
    if not content_type.startswith(ALLOWED_IMAGE_CONTENT_PREFIX):
        return Response(
            {"detail": "Content-Type must be an image/* type."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if "svg" in content_type:
        return Response(
            {"detail": "SVG uploads are not allowed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    size = getattr(uploaded_file, "size", None)
    if size is not None and size > max_bytes:
        mb = max_bytes // (1024 * 1024)
        return Response(
            {"detail": f"File too large. Maximum size is {mb} MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return None


def safe_image_extension(uploaded_file) -> str:
    """Return a normalized allowlisted extension (defaults to .jpg)."""
    name = getattr(uploaded_file, "name", "") or ""
    ext = os.path.splitext(name)[1].lower()
    if ext in ALLOWED_IMAGE_EXTENSIONS:
        return ext
    return ".jpg"
