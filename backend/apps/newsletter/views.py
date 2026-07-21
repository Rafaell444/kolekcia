from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

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

        return Response({"detail": "Subscribed successfully.", "is_new": created})
