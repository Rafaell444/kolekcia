import mimetypes
import os
import re

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.http import FileResponse, Http404, HttpResponse, StreamingHttpResponse
from django.utils._os import safe_join


RANGE_HEADER = re.compile(r"^bytes=(\d*)-(\d*)$")
CHUNK_SIZE = 64 * 1024


def _file_chunks(path: str, start: int, length: int):
    with open(path, "rb") as media_file:
        media_file.seek(start)
        remaining = length
        while remaining > 0:
            chunk = media_file.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def serve_media_with_ranges(request, path: str):
    """Serve local development media with video byte-range support."""
    try:
        full_path = safe_join(settings.MEDIA_ROOT, path)
    except SuspiciousFileOperation as exc:
        raise Http404 from exc

    if not os.path.isfile(full_path):
        raise Http404

    size = os.path.getsize(full_path)
    content_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    match = RANGE_HEADER.match(request.headers.get("Range", ""))

    if not match:
        response = FileResponse(open(full_path, "rb"), content_type=content_type)
        response["Content-Length"] = str(size)
        response["Accept-Ranges"] = "bytes"
        return response

    start_text, end_text = match.groups()
    if not start_text and not end_text:
        return HttpResponse(
            status=416,
            headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"},
        )

    if start_text:
        start = int(start_text)
        end = min(int(end_text), size - 1) if end_text else size - 1
    else:
        suffix_length = int(end_text)
        start = max(size - suffix_length, 0)
        end = size - 1

    if start >= size or start > end:
        return HttpResponse(
            status=416,
            headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"},
        )

    length = end - start + 1
    response = StreamingHttpResponse(
        _file_chunks(full_path, start, length),
        status=206,
        content_type=content_type,
    )
    response["Content-Length"] = str(length)
    response["Content-Range"] = f"bytes {start}-{end}/{size}"
    response["Accept-Ranges"] = "bytes"
    return response
