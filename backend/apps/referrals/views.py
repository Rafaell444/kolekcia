from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .models import ReferralProfile, ReferralInvite
from .serializers import ReferralClaimSerializer
from .services import ensure_referral_profile, _award_referral_signup_xp


class ReferralMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = ensure_referral_profile(request.user)
        total = ReferralInvite.objects.filter(inviter=request.user).count()
        converted = ReferralInvite.objects.filter(inviter=request.user, converted_at__isnull=False).count()
        return Response(
            {
                "code": profile.code,
                "total_invites": total,
                "converted_invites": converted,
            }
        )


class ReferralClaimView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ReferralClaimSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        code = ser.validated_data["code"].strip().upper()
        try:
            profile = ReferralProfile.objects.select_related("user").get(code=code)
        except ReferralProfile.DoesNotExist:
            return Response({"detail": "Invalid referral code."}, status=status.HTTP_400_BAD_REQUEST)

        inviter = profile.user
        invitee = request.user
        if inviter.id == invitee.id:
            return Response({"detail": "You cannot claim your own code."}, status=status.HTTP_400_BAD_REQUEST)

        invite, created = ReferralInvite.objects.get_or_create(
            inviter=inviter, invitee=invitee, defaults={"code": code}
        )
        if created:
            _award_referral_signup_xp(inviter, invitee)
        return Response({"detail": "Referral linked.", "created": created})
