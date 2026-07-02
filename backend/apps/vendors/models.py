from django.db import models
from apps.users.models import User


class Vendor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="vendor_profile")
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    logo_url = models.URLField(blank=True)
    banner_url = models.URLField(blank=True)
    catalog_category_slug = models.SlugField(
        blank=True,
        help_text="Category slug this vendor owns (e.g. figures, wallpanels)",
    )
    description = models.TextField(blank=True)
    social_website = models.URLField(blank=True)
    social_instagram = models.URLField(blank=True)
    social_facebook = models.URLField(blank=True)
    social_twitter = models.URLField(blank=True)
    social_tiktok = models.URLField(blank=True)
    social_youtube = models.URLField(blank=True)
    payment_email = models.EmailField(blank=True)
    # Human-readable label for what custom product type this vendor produces
    custom_product_type = models.CharField(max_length=100, blank=True,
        help_text="e.g. '3D Panel Poster' or '3D Figure'")
    custom_product_description = models.TextField(blank=True,
        help_text="Short blurb shown on the custom order page")
    custom_cover_url = models.URLField(blank=True,
        help_text="Preview / hero image shown on the custom order selection card")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vendors"

    def __str__(self):
        return self.name
