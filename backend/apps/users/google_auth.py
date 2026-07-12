from django.conf import settings
from django.core.exceptions import ValidationError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .models import User


def verify_google_id_token(token: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured.")
    return google_id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,
    )


def authenticate_google_user(id_info: dict) -> tuple[User, bool]:
    google_sub = id_info.get("sub")
    email = (id_info.get("email") or "").strip().lower()
    email_verified = bool(id_info.get("email_verified"))
    name = (id_info.get("name") or "").strip()
    picture = (id_info.get("picture") or "").strip()

    if not google_sub:
        raise ValidationError("Invalid Google account.")
    if not email:
        raise ValidationError("Your Google account has no email address.")

    user = User.objects.filter(google_sub=google_sub).first()
    if user:
        _maybe_update_profile(user, name, picture)
        return user, False

    user = User.objects.filter(email__iexact=email).first()
    if user:
        if user.google_sub and user.google_sub != google_sub:
            raise ValidationError("This email is linked to a different Google account.")
        if user.has_usable_password() and not user.google_sub and not email_verified:
            raise ValidationError("Sign in with your password first, then link Google from account settings.")
        user.google_sub = google_sub
        _maybe_update_profile(user, name, picture)
        user.save(update_fields=["google_sub", "name", "avatar"])
        return user, False

    user = User(
        email=email,
        name=name,
        avatar=picture,
        google_sub=google_sub,
    )
    user.set_unusable_password()
    user.save()
    return user, True


def _maybe_update_profile(user: User, name: str, picture: str) -> None:
    changed = False
    if name and not user.name:
        user.name = name
        changed = True
    if picture and not user.avatar:
        user.avatar = picture
        changed = True
    if changed:
        user.save(update_fields=["name", "avatar"])
