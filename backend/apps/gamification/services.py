from django.db import transaction
from django.db.models import F


def award_xp(user, action_key: str) -> int:
    """
    Award XP to user for the given action.
    Returns the XP awarded (0 if already awarded for a one-time action).
    Thread-safe: uses select_for_update to prevent double-awarding.
    """
    from .models import XPRule, XPLog, GamificationProfile, Badge, UserBadge

    try:
        rule = XPRule.objects.get(action_key=action_key)
    except XPRule.DoesNotExist:
        return 0

    with transaction.atomic():
        if rule.is_one_time:
            _, created = XPLog.objects.get_or_create(
                user=user,
                action=action_key,
                defaults={"xp_amount": rule.xp_amount},
            )
            if not created:
                return 0

        xp_amount = rule.xp_amount

        if not rule.is_one_time:
            XPLog.objects.create(user=user, action=action_key, xp_amount=xp_amount)

        profile, _ = GamificationProfile.objects.select_for_update().get_or_create(user=user)
        profile.xp = F("xp") + xp_amount
        profile.points = F("points") + xp_amount
        profile.save(update_fields=["xp", "points"])
        profile.refresh_from_db()
        profile.recalculate_level()
        profile.save(update_fields=["level"])

        # Check badge triggers
        try:
            badge = Badge.objects.get(trigger_action=action_key)
            UserBadge.objects.get_or_create(user=user, badge=badge)
        except Badge.DoesNotExist:
            pass

    return xp_amount
