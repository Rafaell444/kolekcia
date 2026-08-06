from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError

from .models import User, Address, PaymentMethod, PasswordResetToken
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    AddressSerializer,
    PaymentMethodSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ChangePasswordSerializer,
    GoogleAuthSerializer,
)
from .google_auth import verify_google_id_token, authenticate_google_user
from .services import award_registration_bonus
from django.core.exceptions import ValidationError

PASSWORD_RESET_TOKEN_TTL = timedelta(hours=1)


def _forgot_password_cache_key(email: str) -> str:
    return f"forgot_password:{email.strip().lower()}"


def _forgot_password_quota(email: str) -> tuple[int, int, int]:
    """
    Return (used, remaining, limit) for this email in the current window.
    Does not increment.
    """
    limit = getattr(settings, "FORGOT_PASSWORD_LIMIT", 5)
    key = _forgot_password_cache_key(email)
    used = int(cache.get(key, 0) or 0)
    remaining = max(0, limit - used)
    return used, remaining, limit


def _consume_forgot_password_attempt(email: str) -> tuple[bool, int, int]:
    """
    Consume one attempt. Returns (allowed, remaining_after, limit).
    """
    limit = getattr(settings, "FORGOT_PASSWORD_LIMIT", 5)
    window = getattr(settings, "FORGOT_PASSWORD_WINDOW_SECONDS", 3600)
    key = _forgot_password_cache_key(email)
    used = int(cache.get(key, 0) or 0)
    if used >= limit:
        return False, 0, limit
    used += 1
    cache.set(key, used, timeout=window)
    return True, max(0, limit - used), limit


class AuthThrottle(ScopedRateThrottle):
    scope = "auth"


class ForgotPasswordThrottle(ScopedRateThrottle):
    """IP-level backup throttle (email quota is enforced in the view)."""
    scope = "forgot_password"


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        award_registration_bonus(user)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        )


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {"detail": "Google sign-in is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            id_info = verify_google_id_token(serializer.validated_data["id_token"])
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Google token verification failed: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user, created = authenticate_google_user(id_info)
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            return Response({"detail": "Account is deactivated."}, status=status.HTTP_400_BAD_REQUEST)

        if created:
            award_registration_bonus(user)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "is_new_user": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import os
        import uuid
        from apps.core.uploads import validate_image_upload, safe_image_extension

        file = request.FILES.get("file")
        error = validate_image_upload(file)
        if error:
            return error

        ext = safe_image_extension(file)
        filename = f"{uuid.uuid4().hex}{ext}"
        save_dir = os.path.join(settings.MEDIA_ROOT, "users", "avatars")
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, filename)
        with open(save_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)

        url = request.build_absolute_uri(f"{settings.MEDIA_URL}users/avatars/{filename}")
        request.user.avatar = url
        request.user.save(update_fields=["avatar"])
        return Response(UserSerializer(request.user).data, status=status.HTTP_201_CREATED)


class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class PaymentMethodListCreateView(generics.ListCreateAPIView):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PaymentMethod.objects.filter(user=self.request.user)


class PaymentMethodDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PaymentMethod.objects.filter(user=self.request.user)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["current_password"]):
            return Response({"current_password": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Password changed successfully."})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ForgotPasswordThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        allowed, remaining, limit = _consume_forgot_password_attempt(email)
        if not allowed:
            return Response(
                {
                    "detail": "Too many password reset requests for this email. Try again later.",
                    "remaining": 0,
                    "limit": limit,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if User.objects.filter(email__iexact=email).exists():
            user = User.objects.filter(email__iexact=email).first()
            # Invalidate any previous unused links for this user
            PasswordResetToken.objects.filter(user=user, used=False).update(used=True)
            token_obj = PasswordResetToken.objects.create(user=user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token_obj.token}"
            from apps.emails.service import send_template_email, get_template

            context = {
                "reset_url": reset_url,
                "user_name": user.name or user.email.split("@")[0],
            }
            if get_template("password_reset"):
                send_template_email("password_reset", user.email, context)
            else:
                from apps.emails.service import from_email_for_event

                send_mail(
                    subject="Reset your Koleqcia password",
                    message=f"Click the link to reset your password: {reset_url}",
                    from_email=from_email_for_event("password_reset"),
                    recipient_list=[user.email],
                    fail_silently=True,
                )

        return Response({
            "detail": "If that email exists, a reset link has been sent.",
            "remaining": remaining,
            "limit": limit,
        })


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def _get_valid_token(self, raw_token):
        try:
            token_obj = PasswordResetToken.objects.select_related("user").get(
                token=raw_token, used=False
            )
        except (PasswordResetToken.DoesNotExist, ValueError, TypeError, ValidationError):
            return None
        if token_obj.created_at < timezone.now() - PASSWORD_RESET_TOKEN_TTL:
            return None
        return token_obj

    def get(self, request):
        """Check whether a reset token is still usable (for the reset page)."""
        raw = request.query_params.get("token")
        if not raw or self._get_valid_token(raw) is None:
            return Response(
                {"valid": False, "detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"valid": True})

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token_obj = self._get_valid_token(serializer.validated_data["token"])
        if token_obj is None:
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        token_obj.user.set_password(serializer.validated_data["password"])
        token_obj.user.save()
        # Burn this link and any other outstanding reset links for the user
        PasswordResetToken.objects.filter(user=token_obj.user, used=False).update(used=True)
        return Response({"detail": "Password reset successful."})
