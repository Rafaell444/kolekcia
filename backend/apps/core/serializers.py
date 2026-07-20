from rest_framework import serializers


class SEOSerializer(serializers.Serializer):
    meta_title = serializers.CharField(allow_blank=True)
    meta_description = serializers.CharField(allow_blank=True)
    meta_keywords = serializers.CharField(allow_blank=True)
    og_image = serializers.CharField(allow_blank=True, default="")


class BreadcrumbItemSerializer(serializers.Serializer):
    name = serializers.CharField()
    url = serializers.CharField()


def build_seo_dict(obj, og_image=""):
    """Extract the active-language SEO fields from a model with SEOModelMixin."""
    return {
        "meta_title": getattr(obj, "meta_title", "") or "",
        "meta_description": getattr(obj, "meta_description", "") or "",
        "meta_keywords": getattr(obj, "meta_keywords", "") or "",
        "og_image": og_image,
    }
