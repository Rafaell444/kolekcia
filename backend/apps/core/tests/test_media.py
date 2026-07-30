import tempfile
from pathlib import Path

from django.test import RequestFactory, SimpleTestCase, override_settings

from apps.core.media import serve_media_with_ranges


class RangeMediaResponseTests(SimpleTestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.media_root = Path(self.temp_dir.name)
        (self.media_root / "sample.mp4").write_bytes(b"0123456789")
        self.factory = RequestFactory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_serves_requested_byte_range(self):
        request = self.factory.get("/media/sample.mp4", HTTP_RANGE="bytes=2-5")
        with override_settings(MEDIA_ROOT=self.media_root):
            response = serve_media_with_ranges(request, "sample.mp4")

        self.assertEqual(response.status_code, 206)
        self.assertEqual(response["Content-Range"], "bytes 2-5/10")
        self.assertEqual(response["Content-Length"], "4")
        self.assertEqual(b"".join(response.streaming_content), b"2345")

    def test_full_response_advertises_range_support(self):
        request = self.factory.get("/media/sample.mp4")
        with override_settings(MEDIA_ROOT=self.media_root):
            response = serve_media_with_ranges(request, "sample.mp4")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Accept-Ranges"], "bytes")
        response.close()

    def test_rejects_out_of_bounds_range(self):
        request = self.factory.get("/media/sample.mp4", HTTP_RANGE="bytes=20-30")
        with override_settings(MEDIA_ROOT=self.media_root):
            response = serve_media_with_ranges(request, "sample.mp4")

        self.assertEqual(response.status_code, 416)
        self.assertEqual(response["Content-Range"], "bytes */10")
