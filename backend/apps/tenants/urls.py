from django.urls import path
from .views import TenantDetailView, TenantRevenueView

urlpatterns = [
    path("<str:pk>/", TenantDetailView.as_view(), name="tenant-detail"),
    path("<str:pk>/revenue/", TenantRevenueView.as_view(), name="tenant-revenue"),
]
