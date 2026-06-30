from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Category, Artist, Product, ProductVariant, Review, WishlistItem
from .serializers import (
    CategorySerializer,
    ArtistSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ReviewSerializer,
    WishlistItemSerializer,
    PosterSizeSerializer,
    PosterFinishSerializer,
    PosterFrameSerializer,
)
from .filters import ProductFilter
from apps.products.models import PosterSize, PosterFinish, PosterFrame


class ProductPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class ArtistListView(generics.ListAPIView):
    queryset = Artist.objects.all()
    serializer_class = ArtistSerializer
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["name", "handle"]


class ArtistDetailView(generics.RetrieveAPIView):
    queryset = Artist.objects.all()
    serializer_class = ArtistSerializer
    permission_classes = [AllowAny]
    lookup_field = "handle"


class ProductListView(generics.ListAPIView):
    serializer_class = ProductListSerializer
    permission_classes = [AllowAny]
    pagination_class = ProductPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ["title", "artist__name", "tags"]
    ordering_fields = ["base_price", "rating", "created_at", "review_count"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Product.objects.select_related("artist", "category").prefetch_related("images")
        sort = self.request.query_params.get("sort")
        if sort == "featured":
            qs = qs.order_by("-review_count")
        elif sort == "newest":
            qs = qs.order_by("-created_at")
        elif sort == "price-low":
            qs = qs.order_by("base_price")
        elif sort == "price-high":
            qs = qs.order_by("-base_price")
        return qs


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.select_related("artist", "category").prefetch_related(
        "images", "variants__size", "variants__finish", "variants__frame"
    )
    serializer_class = ProductDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_object(self):
        lookup = (self.kwargs.get("lookup") or "").strip()
        queryset = self.get_queryset()
        return generics.get_object_or_404(queryset, slug=lookup)


class ReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Review.objects.filter(
            product_id=self.kwargs["product_pk"], approved=True
        ).select_related("user")

    def perform_create(self, serializer):
        product_id = self.kwargs["product_pk"]
        if Review.objects.filter(product_id=product_id, user=self.request.user).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "You have already reviewed this product."})
        review = serializer.save(product_id=product_id)
        product = Product.objects.get(pk=product_id)
        approved_reviews = Review.objects.filter(product=product, approved=True)
        count = approved_reviews.count()
        if count > 0:
            from django.db.models import Avg
            avg = approved_reviews.aggregate(avg=Avg("rating"))["avg"]
            product.rating = round(avg, 1)
            product.review_count = count
            product.save(update_fields=["rating", "review_count"])


class WishlistListView(generics.ListCreateAPIView):
    serializer_class = WishlistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user).select_related("product__artist", "product__category").prefetch_related("product__images")


class WishlistItemDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        product_id = kwargs.get("product_id")
        WishlistItem.objects.filter(user=request.user, product_id=product_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PosterOptionsView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "sizes": PosterSizeSerializer(PosterSize.objects.all(), many=True).data,
            "finishes": PosterFinishSerializer(PosterFinish.objects.all(), many=True).data,
            "frames": PosterFrameSerializer(PosterFrame.objects.all(), many=True).data,
        })
