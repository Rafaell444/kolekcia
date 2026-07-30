from rest_framework import serializers
from .models import HeroSlide, Banner, FAQ, SiteSettings, AnnouncementBar, PageSection, HomepageReview, CommunitySocialLink, TrustBarItem, FandomBrand


class HeroSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSlide
        fields = ("id", "type", "image_url", "video_url", "video_poster_url", "headline", "headline_ka", "headline_ru", "subline", "subline_ka", "subline_ru", "cta", "cta_ka", "cta_ru", "cta_href", "accent", "order", "is_active")


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ("id", "title", "title_ka", "title_ru", "subtitle", "subtitle_ka", "subtitle_ru", "cta", "cta_ka", "cta_ru", "cta_href", "image_url", "is_active", "starts_at", "ends_at")


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ("id", "question", "question_ka", "question_ru", "answer", "answer_ka", "answer_ru", "category", "category_ka", "category_ru", "order")


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ("key", "value")


class AnnouncementBarSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementBar
        fields = ("id", "messages", "messages_ka", "messages_ru", "is_active")


class PageSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageSection
        fields = ("id", "page", "section_key", "title", "title_ka", "title_ru", "content", "content_ka", "content_ru", "sort_order", "is_active", "updated_at")


class HomepageReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageReview
        fields = (
            "id", "author_name", "author_initials", "rating", "review_date",
            "text", "source", "google_review_id", "google_review_url", "sort_order", "is_active",
        )


class CommunitySocialLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunitySocialLink
        fields = ("id", "name", "url", "abbr", "bg_color", "text_color", "sort_order", "is_active")


class TrustBarItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustBarItem
        fields = ("id", "key", "title", "description", "icon", "logos", "sort_order", "is_active")


class FandomBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = FandomBrand
        fields = ("id", "name", "abbreviation", "background", "text_color", "link", "sort_order", "is_active")
