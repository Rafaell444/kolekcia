from django.urls import path
from .views import (
    CategoryListView,
    ArtistListView,
    ArtistDetailView,
    ProductListView,
    ProductDetailView,
    ReviewListCreateView,
    WishlistListView,
    WishlistItemDeleteView,
    PosterOptionsView,
)

urlpatterns = [
    path("", ProductListView.as_view(), name="product-list"),
    path("<int:pk>/", ProductDetailView.as_view(), name="product-detail"),
    path("<int:product_pk>/reviews/", ReviewListCreateView.as_view(), name="product-reviews"),
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("artists/", ArtistListView.as_view(), name="artist-list"),
    path("artists/<slug:handle>/", ArtistDetailView.as_view(), name="artist-detail"),
    path("wishlist/", WishlistListView.as_view(), name="wishlist-list"),
    path("wishlist/<int:product_id>/", WishlistItemDeleteView.as_view(), name="wishlist-delete"),
    path("poster-options/", PosterOptionsView.as_view(), name="poster-options"),
]
