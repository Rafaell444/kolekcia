from django.urls import path
from .views import TenantDetailView, TenantRevenueView, TenantProductListView, TenantOrderListView

urlpatterns = [
    path("<str:pk>/", TenantDetailView.as_view(), name="tenant-detail"),
    path("<str:pk>/products/", TenantProductListView.as_view(), name="tenant-products"),
    path("<str:pk>/orders/", TenantOrderListView.as_view(), name="tenant-orders"),
    path("<str:pk>/revenue/", TenantRevenueView.as_view(), name="tenant-revenue"),
]
