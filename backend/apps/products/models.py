from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from apps.users.models import User
from apps.core.seo import SEOModelMixin
from apps.core.transliterate import smart_slugify


class Category(SEOModelMixin):
    SEO_TEMPLATES = {
        "en": {
            "title": "{name} | Koleqcia",
            "description": "Browse {name} collection on Koleqcia.",
        },
        "ka": {
            "title": "{name} | Koleqcia",
            "description": "აღმოაჩინე {name} კოლექცია Koleqcia-ზე.",
        },
        "ru": {
            "title": "{name} | Koleqcia",
            "description": "Коллекция {name} на Koleqcia. Выбирайте лучшее.",
        },
    }

    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    image_url = models.URLField(blank=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "categories"
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Artist(models.Model):
    BADGE_CHOICES = [("Bronze", "Bronze"), ("Silver", "Silver"), ("Gold", "Gold"), ("Platinum", "Platinum"), ("Diamond", "Diamond")]

    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="artist_profile")
    vendor = models.ForeignKey("vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="artists")
    name = models.CharField(max_length=255)
    handle = models.SlugField(unique=True)
    avatar_url = models.URLField(blank=True)
    cover_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    designs = models.PositiveIntegerField(default=0)
    followers = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=1)
    badge = models.CharField(max_length=20, choices=BADGE_CHOICES, default="Bronze")
    verified = models.BooleanField(default=False)

    class Meta:
        db_table = "artists"

    def __str__(self):
        return self.name


class PosterSize(models.Model):
    id = models.CharField(max_length=10, primary_key=True)
    label = models.CharField(max_length=50)
    surcharge = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        db_table = "poster_sizes"

    def __str__(self):
        return self.label


class PosterFinish(models.Model):
    id = models.CharField(max_length=10, primary_key=True)
    label = models.CharField(max_length=50)
    surcharge = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        db_table = "poster_finishes"

    def __str__(self):
        return self.label


class PosterFrame(models.Model):
    id = models.CharField(max_length=10, primary_key=True)
    label = models.CharField(max_length=50)
    surcharge = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        db_table = "poster_frames"

    def __str__(self):
        return self.label


class Product(SEOModelMixin):
    SEO_TEMPLATES = {
        "en": {
            "title": "{name} - {category_name} | {vendor_name} by Koleqcia",
            "description": "Buy the {name} online. Perfect {category_name} for your gaming setup or as a unique gift. Handmade in Georgia by {vendor_name}.",
        },
        "ka": {
            "title": "{name} - {category_name} | {vendor_name}",
            "description": "შეიძინე {name} ონლაინ. საუკეთესო {category_name} შენი ოთახისთვის. უნიკალური საჩუქარი, დამზადებულია საქართველოში {vendor_name}-ის მიერ.",
        },
        "ru": {
            "title": "{name} - {category_name} | {vendor_name}",
            "description": "Закажите {name} онлайн. Идеальный {category_name} и необычный подарок ручной работы. Сделано в Грузии брендом {vendor_name}.",
        },
    }

    STATUS_CHOICES = [
        ("active", "Active"),
        ("paused", "Paused"),
        ("sold", "Sold"),
    ]

    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=280, blank=True)
    artist = models.ForeignKey(Artist, on_delete=models.SET_NULL, null=True, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")
    categories = models.ManyToManyField(Category, blank=True, related_name="all_products")
    vendor = models.ForeignKey("vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="products")
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    regional_prices = models.JSONField(default=dict, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    review_count = models.PositiveIntegerField(default=0)
    is_limited = models.BooleanField(default=False)
    is_sale = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False, db_index=True)
    is_ready_to_ship = models.BooleanField(default=False)
    allow_custom_size = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    description = models.TextField(blank=True)
    material = models.CharField(max_length=255, blank=True)
    tags = models.JSONField(default=list)
    processing_time_label = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = smart_slugify(self.title) or "product"
            candidate = base
            n = 1
            while Product.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{n}"
                n += 1
            self.slug = candidate
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    MEDIA_CHOICES = [("image", "Image"), ("video", "Video")]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    url = models.URLField(blank=True)
    video_file = models.FileField(upload_to="products/videos/", null=True, blank=True)
    media_type = models.CharField(max_length=10, choices=MEDIA_CHOICES, default="image")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "product_images"
        ordering = ["order"]


class SizeVariant(models.Model):
    """Simplified size variant with its own explicit USD price and regional overrides."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="size_variants")
    label = models.CharField(max_length=50)
    price_usd = models.DecimalField(max_digits=10, decimal_places=2)
    price_gel = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_eur = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_gbp = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sale_price_usd = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sale_price_gel = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    stock = models.IntegerField(null=True, blank=True, default=None)
    images = models.ManyToManyField("ProductImage", blank=True, related_name="size_variants")

    class Meta:
        db_table = "size_variants"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.product.title} — {self.label} (${self.price_usd})"


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    size = models.ForeignKey(PosterSize, on_delete=models.PROTECT)
    finish = models.ForeignKey(PosterFinish, on_delete=models.PROTECT)
    frame = models.ForeignKey(PosterFrame, on_delete=models.PROTECT)
    stock = models.PositiveIntegerField(default=100)
    surcharge = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        db_table = "product_variants"
        unique_together = ("product", "size", "finish", "frame")

    @property
    def price(self):
        # Defensive cast: some API update paths may keep in-memory values as strings
        # until reloaded, while surcharge is Decimal.
        return Decimal(self.product.base_price) + Decimal(self.surcharge)

    def __str__(self):
        return f"{self.product.title} — {self.size_id}/{self.finish_id}/{self.frame_id}"


class WishlistItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wishlist_items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="wishlisted_by")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wishlist_items"
        unique_together = ("user", "product")


class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    text = models.TextField()
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reviews"
        unique_together = ("product", "user")

    def __str__(self):
        return f"{self.user.email} → {self.product.title} ({self.rating}★)"


DEFAULT_VISIBLE_FILTERS = {
    "category": True,
    "price": True,
    "size": True,
    "theme": True,
    "material": True,
    "artist": True,
    "availability": True,
}


class CatalogFilterConfig(models.Model):
    SCOPE_CHOICES = [
        ("global", "Global"),
        ("category", "Category"),
        ("vendor", "Vendor"),
    ]

    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES)
    category_slug = models.CharField(max_length=80, blank=True, default="")
    vendor = models.ForeignKey(
        "vendors.Vendor",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="filter_configs",
    )
    visible_filters = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "catalog_filter_configs"
        constraints = [
            models.UniqueConstraint(
                fields=["scope", "category_slug", "vendor"],
                name="unique_catalog_filter_config_scope",
            ),
        ]

    def __str__(self):
        if self.scope == "vendor" and self.vendor_id:
            return f"Filters ({self.vendor})"
        if self.scope == "category" and self.category_slug:
            return f"Filters ({self.category_slug})"
        return "Filters (global)"

    def resolved_filters(self) -> dict:
        merged = dict(DEFAULT_VISIBLE_FILTERS)
        if isinstance(self.visible_filters, dict):
            merged.update(self.visible_filters)
        return merged
