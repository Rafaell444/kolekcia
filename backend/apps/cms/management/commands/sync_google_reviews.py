import json
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_datetime


class Command(BaseCommand):
    help = "Import Google reviews into the hidden homepage-review approval queue."

    def handle(self, *args, **options):
        endpoint = getattr(settings, "GOOGLE_REVIEWS_API_URL", "").strip()
        token = getattr(settings, "GOOGLE_REVIEWS_API_TOKEN", "").strip()
        if not endpoint:
            raise CommandError("GOOGLE_REVIEWS_API_URL is not configured.")

        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            with urlopen(Request(endpoint, headers=headers), timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise CommandError(f"Google review feed request failed: {exc}") from exc

        rows = payload.get("reviews", payload) if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            raise CommandError("Google review feed must return a list or {reviews: [...]}." )

        from apps.cms.models import HomepageReview

        imported = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            review_id = str(row.get("review_id") or row.get("id") or "").strip()
            text = str(row.get("text") or row.get("comment") or "").strip()
            if not review_id or not text:
                continue
            published_at = parse_datetime(str(row.get("create_time") or row.get("published_at") or ""))
            review, created = HomepageReview.objects.update_or_create(
                google_review_id=review_id,
                defaults={
                    "author_name": str(row.get("reviewer_name") or row.get("author_name") or "Google customer")[:100],
                    "author_initials": "",
                    "rating": max(1, min(5, int(row.get("star_rating") or row.get("rating") or 5))),
                    "review_date": published_at.strftime("%B %Y") if published_at else "",
                    "text": text,
                    "source": "google",
                    "google_review_url": str(row.get("review_url") or "")[:500],
                    "is_active": False,
                },
            )
            imported += int(created or review is not None)

        self.stdout.write(self.style.SUCCESS(f"Google reviews imported/updated: {imported}"))
