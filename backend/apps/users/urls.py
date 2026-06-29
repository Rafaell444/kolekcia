from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    AddressListCreateView,
    AddressDetailView,
    PaymentMethodListCreateView,
    PaymentMethodDetailView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("addresses/", AddressListCreateView.as_view(), name="address-list"),
    path("addresses/<int:pk>/", AddressDetailView.as_view(), name="address-detail"),
    path("payment-methods/", PaymentMethodListCreateView.as_view(), name="payment-list"),
    path("payment-methods/<int:pk>/", PaymentMethodDetailView.as_view(), name="payment-detail"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
]
