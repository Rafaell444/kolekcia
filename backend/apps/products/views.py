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
        qs = Product.objects.filter(status="active").select_related("artist", "category").prefetch_related("images", "size_variants", "processing_options")
        sort = self.request.query_params.get("sort")
        if sort == "featured":
            # Show all products, featured ones first, then by review count
            from django.db.models import Case, When, IntegerField
            qs = qs.annotate(
                _featured_order=Case(
                    When(is_featured=True, then=0),
                    default=1,
                    output_field=IntegerField(),
                )
            ).order_by("_featured_order", "-review_count")
        elif sort == "newest":
            qs = qs.order_by("-created_at")
        elif sort == "price-low":
            qs = qs.order_by("base_price")
        elif sort == "price-high":
            qs = qs.order_by("-base_price")
        return qs


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(status="active").select_related("artist", "category").prefetch_related(
        "images", "variants__size", "variants__finish", "variants__frame", "processing_options"
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


class ProductFilterOptionsView(generics.GenericAPIView):
    """Returns distinct filter values for the given category/context."""
    permission_classes = [AllowAny]

    # Tags to always suppress — they duplicate the locked category or reflect product status flags
    _SUPPRESS_TAGS = {
        "Figure", "Figures", "Wallpanel", "Wallpanels", "Panel", "Panels",
        "Sale", "Exclusive", "Limited", "New", "New Arrival",
    }

    def get(self, request):
        from .models import SizeVariant
        from django.db.models import Q
        category = (request.query_params.get("category") or "").strip().lower()

        qs = Product.objects.filter(status="active")
        if category in {"figures", "figure"}:
            slug = "figures"
        elif category in {"wallpanels", "wallpanel", "panels"}:
            slug = "wallpanels"
        else:
            slug = category
        if slug:
            qs = qs.filter(
                Q(category__slug__iexact=slug) | Q(categories__slug__iexact=slug)
            ).distinct()

        product_ids = list(qs.values_list("id", flat=True))

        # Distinct non-empty materials
        raw_materials = (
            qs.exclude(material="")
              .values_list("material", flat=True)
              .distinct()
        )
        materials = sorted(set(m.strip() for m in raw_materials if m.strip()))

        # Distinct size variant labels for these products
        size_labels = list(
            SizeVariant.objects.filter(product_id__in=product_ids, is_active=True)
              .values_list("label", flat=True)
              .distinct()
              .order_by("label")
        )

        # Themes — gather all tags from products, deduplicate, sort, and exclude generic ones
        all_tags_qs = qs.values_list("tags", flat=True)
        theme_set: set[str] = set()
        for tag_list in all_tags_qs:
            if isinstance(tag_list, list):
                for t in tag_list:
                    cleaned = (t or "").strip()
                    if cleaned and cleaned not in self._SUPPRESS_TAGS:
                        theme_set.add(cleaned)
        themes = sorted(theme_set)

        # Artists
        artists = list(
            qs.exclude(artist=None)
              .select_related("artist")
              .values("artist__handle", "artist__name")
              .distinct()
              .order_by("artist__name")
        )

        # Use the exact variant prices displayed in the selected market.
        currency = request.query_params.get("currency", "USD").upper()
        if currency not in {"USD", "GEL", "EUR", "GBP"}:
            currency = "USD"
        price_field = f"price_{currency.lower()}"
        sale_field = f"sale_price_{currency.lower()}" if currency in {"USD", "GEL"} else None
        selected_fields = ["product_id", "price_usd", price_field]
        if sale_field:
            selected_fields.append(sale_field)

        prices = []
        products_with_variants = set()
        variants = SizeVariant.objects.filter(
            product_id__in=product_ids, is_active=True
        ).only(*selected_fields)
        for variant in variants:
            products_with_variants.add(variant.product_id)
            regular = getattr(variant, price_field, None) or variant.price_usd
            sale = getattr(variant, sale_field, None) if sale_field else None
            prices.append(sale if sale is not None and sale < regular else regular)

        for product in qs.exclude(id__in=products_with_variants).only("base_price", "regional_prices"):
            regional = (product.regional_prices or {}).get(currency, {})
            prices.append(regional.get("price") or product.base_price)

        numeric_prices = [float(price) for price in prices if price is not None]
        price_min = min(numeric_prices) if numeric_prices else 0
        price_max = max(numeric_prices) if numeric_prices else 250
        availability = {
            "limited": qs.filter(is_limited=True).exists(),
            "sale": qs.filter(is_sale=True).exists(),
            "new": qs.filter(is_new=True).exists(),
            "exclusive": qs.filter(is_exclusive=True).exists(),
        }

        return Response({
            "materials": materials,
            "sizes": size_labels,
            "themes": themes,
            "artists": [{"handle": a["artist__handle"], "name": a["artist__name"]} for a in artists],
            "price_range": {"min": price_min, "max": price_max},
            "availability": availability,
        })


class CatalogFilterConfigView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from .filter_config import resolve_catalog_filter_visibility

        category = request.query_params.get("category", "")
        return Response(resolve_catalog_filter_visibility(category))
