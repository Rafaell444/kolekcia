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
    ProductFilterOptionsView,
    CatalogFilterConfigView,
)

urlpatterns = [
    path("", ProductListView.as_view(), name="product-list"),
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("artists/", ArtistListView.as_view(), name="artist-list"),
    path("artists/<slug:handle>/", ArtistDetailView.as_view(), name="artist-detail"),
    path("wishlist/", WishlistListView.as_view(), name="wishlist-list"),
    path("wishlist/<int:product_id>/", WishlistItemDeleteView.as_view(), name="wishlist-delete"),
    path("poster-options/", PosterOptionsView.as_view(), name="poster-options"),
    path("filter-options/", ProductFilterOptionsView.as_view(), name="product-filter-options"),
    path("catalog-filter-config/", CatalogFilterConfigView.as_view(), name="catalog-filter-config"),
    path("<int:product_pk>/reviews/", ReviewListCreateView.as_view(), name="product-reviews"),
    path("<str:lookup>/", ProductDetailView.as_view(), name="product-detail"),
]
