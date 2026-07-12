from rest_framework import serializers
from .models import HeroSlide, Banner, FAQ, SiteSettings, AnnouncementBar, PageSection, HomepageReview, CommunitySocialLink


class HeroSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSlide
        fields = ("id", "type", "image_url", "video_url", "video_poster_url", "headline", "subline", "cta", "cta_href", "accent", "order", "is_active")


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ("id", "title", "subtitle", "cta", "cta_href", "image_url", "is_active", "starts_at", "ends_at")


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ("id", "question", "answer", "category", "order")


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ("key", "value")


class AnnouncementBarSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementBar
        fields = ("id", "messages", "is_active")


class PageSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageSection
        fields = ("id", "page", "section_key", "title", "content", "sort_order", "is_active", "updated_at")


class HomepageReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageReview
        fields = (
            "id", "author_name", "author_initials", "rating", "review_date",
            "text", "source", "sort_order", "is_active",
        )


class CommunitySocialLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunitySocialLink
        fields = ("id", "name", "url", "abbr", "bg_color", "text_color", "sort_order", "is_active")
