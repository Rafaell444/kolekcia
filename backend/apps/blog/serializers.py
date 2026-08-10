from rest_framework import serializers
from .models import BlogPost


class BlogPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = (
            "id",
            "title", "title_ka",
            "slug",
            "excerpt", "excerpt_ka",
            "content", "content_ka",
            "content_blocks",
            "cover_image_url",
            "is_published",
            "published_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")
