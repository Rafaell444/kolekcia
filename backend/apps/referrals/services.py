from django.db import transaction
from django.utils import timezone


def ensure_referral_profile(user):
    from .models import ReferralProfile

    profile, _ = ReferralProfile.objects.get_or_create(user=user)
    return profile


def _award_referral_signup_xp(inviter, invitee):
    return None


@transaction.atomic
def process_referral_conversion(invitee_user):
    from apps.orders.models import Order
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
