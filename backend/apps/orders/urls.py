from django.urls import path
from .views import (
    CartView,
    CartItemView,
    PromoApplyView,
    CheckoutView,
    OrderListView,
    OrderDetailView,
    CustomOrderCreateView,
)

urlpatterns = [
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/items/", CartItemView.as_view(), name="cart-items"),
    path("cart/items/<int:item_id>/", CartItemView.as_view(), name="cart-item-detail"),
    path("cart/promo/", PromoApplyView.as_view(), name="promo-apply"),
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    path("", OrderListView.as_view(), name="order-list"),
    path("<uuid:pk>/", OrderDetailView.as_view(), name="order-detail"),
    path("custom/", CustomOrderCreateView.as_view(), name="custom-order"),
]
