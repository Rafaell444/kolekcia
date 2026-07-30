from django.urls import path
from .views import CreatorApplyView, CreatorMeView, CreatorPayoutView

urlpatterns = [
    path("apply/", CreatorApplyView.as_view(), name="creator-apply"),
    path("me/", CreatorMeView.as_view(), name="creator-me"),
    path("payout/", CreatorPayoutView.as_view(), name="creator-payout"),
]
