def award_registration_bonus(user) -> None:
    try:
        from apps.gamification.models import XPRule
        from apps.gamification.services import award_xp

        XPRule.objects.update_or_create(
            action_key="registration_bonus",
            defaults={
                "xp_amount": 5,
                "is_one_time": True,
                "description": "New member welcome bonus",
            },
        )
        award_xp(user, "registration_bonus", xp_amount=5)
    except Exception:
        pass
