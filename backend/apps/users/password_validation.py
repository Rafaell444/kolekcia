"""Koleqcia password strength rules."""

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class KoleqciaPasswordValidator:
    """
    Require:
    - at least `min_length` characters (default 8)
    - at least one uppercase letter
    - at least one symbol (non-alphanumeric)
    """

    def __init__(self, min_length=8):
        self.min_length = min_length

    def validate(self, password, user=None):
        errors = []
        if len(password) < self.min_length:
            errors.append(
                ValidationError(
                    _("Password must be at least %(min_length)d characters."),
                    code="password_too_short",
                    params={"min_length": self.min_length},
                )
            )
        if not any(c.isupper() for c in password):
            errors.append(
                ValidationError(
                    _("Password must include at least one uppercase letter."),
                    code="password_no_upper",
                )
            )
        if not any(not c.isalnum() for c in password):
            errors.append(
                ValidationError(
                    _("Password must include at least one symbol (e.g. !@#$%)."),
                    code="password_no_symbol",
                )
            )
        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must be at least %(min_length)d characters, include "
            "one uppercase letter, and one symbol."
        ) % {"min_length": self.min_length}
