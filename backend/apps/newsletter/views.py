from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from django.conf import settings

from .models import NewsletterSubscriber


class NewsletterThrottle(ScopedRateThrottle):
    scope = "newsletter"


class NewsletterSubscribeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [NewsletterThrottle]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        subscriber, created = NewsletterSubscriber.objects.get_or_create(email=email)

        if created and not subscriber.xp_awarded:
            subscriber.xp_awarded = True
            subscriber.save(update_fields=["xp_awarded"])
            if request.user.is_authenticated:
                try:
                    from apps.gamification.services import award_xp
                    award_xp(request.user, "newsletter_signup")
                except Exception:
                    pass

        from apps.emails.default_templates import get_default_templates
        from apps.emails.models import EmailTemplate
        from apps.emails.service import send_template_email
        from apps.promo.models import PromoCode

        promo, _ = PromoCode.objects.update_or_create(
            code="NEWSLETTER25",
            defaults={
                "discount_type": "percent",
                "discount_value": 25,
                "max_uses_per_user": 1,
                "is_active": True,
            },
        )
        if not EmailTemplate.objects.filter(event_key="newsletter_welcome", vendor__isnull=True).exists():
            payload = next(item for item in get_default_templates() if item["event_key"] == "newsletter_welcome")
            EmailTemplate.objects.create(**payload)
        email_sent = send_template_email(
            "newsletter_welcome",
            email,
            {
                "promo_code": promo.code,
                "shop_url": f"{settings.FRONTEND_URL}/en/catalog",
            },
        )

        return Response({"detail": "Subscribed successfully.", "is_new": created, "email_sent": email_sent})
