from django.urls import path
from .views import (
    VendorMeView,
    VendorDashboardView,
    VendorProductListView,
    VendorProductDetailView,
    VendorOrderListView,
    VendorCustomerListView,
    VendorAnalyticsView,
    VendorPublicListView,
    VendorCustomOrderListView,
)

urlpatterns = [
    path("public/", VendorPublicListView.as_view(), name="vendor-public-list"),
    path("me/", VendorMeView.as_view(), name="vendor-me"),
    path("me/dashboard/", VendorDashboardView.as_view(), name="vendor-dashboard"),
    path("me/products/", VendorProductListView.as_view(), name="vendor-products"),
    path("me/products/<int:pk>/", VendorProductDetailView.as_view(), name="vendor-product-detail"),
    path("me/orders/", VendorOrderListView.as_view(), name="vendor-orders"),
    path("me/customers/", VendorCustomerListView.as_view(), name="vendor-customers"),
    path("me/analytics/", VendorAnalyticsView.as_view(), name="vendor-analytics"),
    path("me/custom-orders/", VendorCustomOrderListView.as_view(), name="vendor-custom-orders"),
    path("me/custom-orders/<uuid:pk>/", VendorCustomOrderListView.as_view(), name="vendor-custom-order-detail"),
]
