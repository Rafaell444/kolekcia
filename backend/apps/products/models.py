from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.users.models import User


class Category(models.Model):
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


class Product(models.Model):
    title = models.CharField(max_length=255)
    artist = models.ForeignKey(Artist, on_delete=models.SET_NULL, null=True, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name="products")
    vendor = models.ForeignKey("vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="products")
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    review_count = models.PositiveIntegerField(default=0)
    is_limited = models.BooleanField(default=False)
    is_sale = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    tags = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"

    def __str__(self):
        return self.title


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    url = models.URLField()
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "product_images"
        ordering = ["order"]


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
        return self.product.base_price + self.surcharge

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
