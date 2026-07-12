from django.db import models


class HeroSlide(models.Model):
    TYPE_CHOICES = [("image", "Image"), ("video", "Video")]

    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default="image")
    image_url = models.URLField(blank=True)
    video_url = models.URLField(blank=True)
    video_poster_url = models.URLField(blank=True)
    headline = models.CharField(max_length=255)
    subline = models.TextField(blank=True)
    cta = models.CharField(max_length=100, blank=True)
    cta_href = models.CharField(max_length=255, blank=True)
    accent = models.CharField(max_length=20, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "hero_slides"
        ordering = ["order"]

    def __str__(self):
        return self.headline


class Banner(models.Model):
    title = models.CharField(max_length=255)
    subtitle = models.TextField(blank=True)
    cta = models.CharField(max_length=100, blank=True)
    cta_href = models.CharField(max_length=255, blank=True)
    image_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "banners"

    def __str__(self):
        return self.title


class FAQ(models.Model):
    question = models.CharField(max_length=500)
    answer = models.TextField()
    category = models.CharField(max_length=50, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "faqs"
        ordering = ["order"]

    def __str__(self):
        return self.question


class SiteSettings(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()

    class Meta:
        db_table = "site_settings"

    def __str__(self):
        return self.key


class AnnouncementBar(models.Model):
    messages = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "announcement_bars"


class HomepageReview(models.Model):
    SOURCE_CHOICES = [("google", "Google"), ("admin", "Staff Pick")]

    author_name = models.CharField(max_length=100)
    author_initials = models.CharField(max_length=4, blank=True)
    rating = models.PositiveSmallIntegerField(default=5)
    review_date = models.CharField(max_length=50, blank=True)
    text = models.TextField()
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="admin")
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "homepage_reviews"
        ordering = ["sort_order", "-id"]

    def __str__(self):
        return self.author_name


class CommunitySocialLink(models.Model):
    name = models.CharField(max_length=50)
    url = models.URLField(blank=True, default="")
    abbr = models.CharField(max_length=10)
    bg_color = models.CharField(max_length=20, default="#000000")
    text_color = models.CharField(max_length=20, default="#ffffff")
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "community_social_links"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class PageSection(models.Model):
    PAGE_CHOICES = [
        ("home", "Homepage"),
        ("about", "About"),
        ("contact", "Contact"),
        ("product", "Product Page"),
    ]

    page = models.CharField(max_length=20, choices=PAGE_CHOICES)
    section_key = models.CharField(max_length=80)
    title = models.CharField(max_length=255)
    content = models.JSONField(default=dict)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "page_sections"
        ordering = ["page", "sort_order"]
        unique_together = [("page", "section_key")]

    def __str__(self):
        return f"{self.page}/{self.section_key}"
