from django.urls import path

from .views import (
    LoyaltyProfileView,
    PointTransactionListView,
    PointsMarketItemListView,
    PointsMarketPhysicalRedemptionView,
    PointsMarketPurchaseView,
    PointsMarketRedemptionListView,
    PointsMarketShippingPaymentCompleteView,
    PointsMarketShippingPaymentSessionView,
    PointsMarketShippingOptionsView,
)

urlpatterns = [
    path("profile/", LoyaltyProfileView.as_view(), name="loyalty-profile"),
    path("transactions/", PointTransactionListView.as_view(), name="point-transactions"),
    path("market/", PointsMarketItemListView.as_view(), name="points-market"),
    path("market/shipping-options/", PointsMarketShippingOptionsView.as_view(), name="points-market-shipping-options"),
    path("market/purchase/", PointsMarketPurchaseView.as_view(), name="points-market-purchase"),
    path("market/redeem-physical/", PointsMarketPhysicalRedemptionView.as_view(), name="points-market-redeem-physical"),
    path("market/redemptions/", PointsMarketRedemptionListView.as_view(), name="points-market-redemptions"),
    path("market/shipping-payment/<uuid:token>/", PointsMarketShippingPaymentSessionView.as_view(), name="points-market-shipping-payment"),
    path("market/shipping-payment/<uuid:token>/complete/", PointsMarketShippingPaymentCompleteView.as_view(), name="points-market-shipping-payment-complete"),
]
