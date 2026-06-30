from django.db import models
from django.utils.crypto import get_random_string


def generate_referral_code() -> str:
    return get_random_string(10).upper()


class ReferralProfile(models.Model):
    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="referral_profile")
    code = models.CharField(max_length=32, unique=True, default=generate_referral_code)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "referral_profiles"


class ReferralInvite(models.Model):
    inviter = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="sent_referrals")
    invitee = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="received_referrals")
    code = models.CharField(max_length=32)
    claimed_at = models.DateTimeField(auto_now_add=True)
    converted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "referral_invites"
        unique_together = ("inviter", "invitee")
