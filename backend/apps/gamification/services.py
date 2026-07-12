from django.db import transaction
from django.db.models import F


def _grant_badge_for_action(user, action_key: str) -> bool:
    """Create UserBadge (+ promo grant) when a badge trigger matches. Returns True if newly earned."""
    from .models import Badge, UserBadge

    try:
        badge = Badge.objects.select_related("prize_promo").get(trigger_action=action_key)
    except Badge.DoesNotExist:
        return False

    _, badge_created = UserBadge.objects.get_or_create(user=user, badge=badge)
    if badge.prize_promo_id:
        from apps.promo.models import UserPromoGrant
        UserPromoGrant.objects.get_or_create(
            user=user,
            promo=badge.prize_promo,
            source_badge=badge,
        )
    return badge_created


def sync_earned_badges_from_xp(user) -> int:
    """
    Backfill badges for XP actions already logged (e.g. before badge code shipped).
    Returns count of newly created UserBadge rows.
    """
    from .models import XPLog

    created = 0
    actions = XPLog.objects.filter(user=user).values_list("action", flat=True).distinct()
    for action_key in actions:
        if _grant_badge_for_action(user, action_key):
            created += 1
    return created


def award_xp(user, action_key: str, xp_amount: int | None = None) -> int:
    """
    Award XP to user for the given action.
    Returns the XP awarded (0 if already awarded for a one-time action).
    Thread-safe: uses select_for_update to prevent double-awarding.
    """
    from .models import XPRule, XPLog, GamificationProfile

    try:
        rule = XPRule.objects.get(action_key=action_key)
    except XPRule.DoesNotExist:
        return 0

    amount = xp_amount if xp_amount is not None else rule.xp_amount

    with transaction.atomic():
        if rule.is_one_time:
            _, created = XPLog.objects.get_or_create(
                user=user,
                action=action_key,
                defaults={"xp_amount": amount},
            )
            if not created:
                _grant_badge_for_action(user, action_key)
                return 0

        if not rule.is_one_time:
            XPLog.objects.create(user=user, action=action_key, xp_amount=amount)

        profile, _ = GamificationProfile.objects.select_for_update().get_or_create(user=user)
        profile.xp = F("xp") + amount
        profile.points = F("points") + amount
        profile.save(update_fields=["xp", "points"])
        profile.refresh_from_db()
        profile.recalculate_level()
        profile.save(update_fields=["level"])

        _grant_badge_for_action(user, action_key)

    return amount
