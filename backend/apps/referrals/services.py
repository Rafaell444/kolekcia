from django.db import transaction
from django.utils import timezone


def ensure_referral_profile(user):
    from .models import ReferralProfile

    profile, _ = ReferralProfile.objects.get_or_create(user=user)
    return profile


@transaction.atomic
def process_referral_conversion(invitee_user):
    from apps.orders.models import Order
    from apps.gamification.models import XPRule
    from apps.gamification.services import award_xp
    from .models import ReferralInvite

    order_count = Order.objects.filter(user=invitee_user).count()
    if order_count != 1:
        return

    invite = (
        ReferralInvite.objects.select_for_update()
        .filter(invitee=invitee_user, converted_at__isnull=True)
        .order_by("-claimed_at")
        .first()
    )
    if not invite:
        return

    invite.converted_at = timezone.now()
    invite.save(update_fields=["converted_at"])

    XPRule.objects.get_or_create(
        action_key="referral_inviter_purchase",
        defaults={"xp_amount": 300, "is_one_time": False, "description": "Referral conversion reward for inviter"},
    )
    XPRule.objects.get_or_create(
        action_key="referral_invitee_purchase",
        defaults={"xp_amount": 200, "is_one_time": True, "description": "Referral first purchase reward for invitee"},
    )

    award_xp(invite.inviter, "referral_inviter_purchase")
    award_xp(invitee_user, "referral_invitee_purchase")
