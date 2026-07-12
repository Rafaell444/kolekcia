from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HeroSlide, Banner, FAQ, SiteSettings, AnnouncementBar, PageSection, HomepageReview, CommunitySocialLink
from .serializers import (
    HeroSlideSerializer, BannerSerializer, FAQSerializer, SiteSettingsSerializer,
    AnnouncementBarSerializer, PageSectionSerializer, HomepageReviewSerializer,
    CommunitySocialLinkSerializer,
)


class HeroSlidesView(generics.ListAPIView):
    queryset = HeroSlide.objects.filter(is_active=True)
    serializer_class = HeroSlideSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class BannersView(generics.ListAPIView):
    queryset = Banner.objects.filter(is_active=True)
    serializer_class = BannerSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class FAQListView(generics.ListAPIView):
    serializer_class = FAQSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = FAQ.objects.all()
        category = self.request.query_params.get("category")
        if category:
            return qs.filter(category=category)
        return qs.exclude(category="auction")


class HomepageReviewListView(generics.ListAPIView):
    queryset = HomepageReview.objects.filter(is_active=True)
    serializer_class = HomepageReviewSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class CommunitySocialLinkListView(generics.ListAPIView):
    queryset = CommunitySocialLink.objects.filter(is_active=True)
    serializer_class = CommunitySocialLinkSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class SiteSettingsView(APIView):
    permission_classes = [AllowAny]

    PUBLIC_KEYS = {"site_name", "site_url", "support_email", "support_phone"}

    def get(self, request):
        settings = SiteSettings.objects.filter(key__in=self.PUBLIC_KEYS)
        return Response({s.key: s.value for s in settings})


class PageSectionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, page):
        sections = PageSection.objects.filter(page=page, is_active=True).order_by("sort_order")
        return Response(PageSectionSerializer(sections, many=True).data)


class AnnouncementBarView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        bar = AnnouncementBar.objects.filter(is_active=True).first()
        if bar:
            return Response(AnnouncementBarSerializer(bar).data)
        return Response({"messages": [], "is_active": False})
