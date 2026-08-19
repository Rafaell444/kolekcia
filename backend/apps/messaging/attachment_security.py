from dataclasses import dataclass
from pathlib import Path

from django.core.cache import cache


MAX_FILES_PER_MESSAGE = 3
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_VIDEO_BYTES = 25 * 1024 * 1024
MAX_MESSAGE_BYTES = 30 * 1024 * 1024
MAX_FILES_PER_HOUR = 20
MAX_BYTES_PER_HOUR = 100 * 1024 * 1024

IMAGE_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/gif": {".gif"},
}
VIDEO_TYPES = {
    "video/mp4": {".mp4", ".m4v"},
    "video/webm": {".webm"},
    "video/quicktime": {".mov"},
}


@dataclass(frozen=True)
class AttachmentDecision:
    allowed: bool
    detail: str = ""


def _has_valid_signature(upload, mime: str) -> bool:
    position = upload.tell()
    header = upload.read(32)
    upload.seek(position)
    if mime == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")
    if mime == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if mime == "image/gif":
        return header.startswith((b"GIF87a", b"GIF89a"))
    if mime == "image/webp":
        return header.startswith(b"RIFF") and header[8:12] == b"WEBP"
    if mime in ("video/mp4", "video/quicktime"):
        return len(header) >= 12 and header[4:8] == b"ftyp"
    if mime == "video/webm":
        return header.startswith(b"\x1a\x45\xdf\xa3")
    return False


def validate_customer_attachments(user, files) -> AttachmentDecision:
    if len(files) > MAX_FILES_PER_MESSAGE:
        return AttachmentDecision(False, f"You can attach up to {MAX_FILES_PER_MESSAGE} files per message.")

    total_size = sum(upload.size for upload in files)
    if total_size > MAX_MESSAGE_BYTES:
        return AttachmentDecision(False, "Attachments can total up to 30 MB per message.")

    for upload in files:
        mime = (upload.content_type or "").lower().split(";", 1)[0]
        extension = Path(upload.name).suffix.lower()
        allowed_extensions = IMAGE_TYPES.get(mime) or VIDEO_TYPES.get(mime)
        if not allowed_extensions or extension not in allowed_extensions:
            return AttachmentDecision(
                False,
                "Only JPEG, PNG, WebP, GIF, MP4, WebM, and MOV files are allowed.",
            )
        limit = MAX_IMAGE_BYTES if mime in IMAGE_TYPES else MAX_VIDEO_BYTES
        label = "Images" if mime in IMAGE_TYPES else "Videos"
        limit_mb = limit // (1024 * 1024)
        if upload.size > limit:
            return AttachmentDecision(False, f"{label} can be up to {limit_mb} MB each.")
        if not _has_valid_signature(upload, mime):
            return AttachmentDecision(False, f'"{upload.name}" does not match its declared file type.')

    count_key = f"inbox-upload-count:{user.pk}"
    bytes_key = f"inbox-upload-bytes:{user.pk}"
    current_count = int(cache.get(count_key, 0))
    current_bytes = int(cache.get(bytes_key, 0))
    if current_count + len(files) > MAX_FILES_PER_HOUR:
        return AttachmentDecision(False, "Hourly attachment limit reached. Please try again later.")
    if current_bytes + total_size > MAX_BYTES_PER_HOUR:
        return AttachmentDecision(False, "Hourly upload size limit reached. Please try again later.")
    return AttachmentDecision(True)


def record_customer_attachments(user, files) -> None:
    count_key = f"inbox-upload-count:{user.pk}"
    bytes_key = f"inbox-upload-bytes:{user.pk}"
    count = int(cache.get(count_key, 0)) + len(files)
    size = int(cache.get(bytes_key, 0)) + sum(upload.size for upload in files)
    cache.set(count_key, count, timeout=3600)
    cache.set(bytes_key, size, timeout=3600)
