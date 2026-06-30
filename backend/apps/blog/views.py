from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import BlogPost
from .serializers import BlogPostSerializer


class BlogPostListView(generics.ListAPIView):
    serializer_class = BlogPostSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        now = timezone.now()
        return BlogPost.objects.filter(is_published=True, published_at__isnull=False, published_at__lte=now)


class BlogPostDetailView(generics.RetrieveAPIView):
    serializer_class = BlogPostSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        now = timezone.now()
        return BlogPost.objects.filter(is_published=True, published_at__isnull=False, published_at__lte=now)
