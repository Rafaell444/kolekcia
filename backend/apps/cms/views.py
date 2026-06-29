from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HeroSlide, Banner, FAQ, SiteSettings, AnnouncementBar
from .serializers import HeroSlideSerializer, BannerSerializer, FAQSerializer, SiteSettingsSerializer, AnnouncementBarSerializer


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
    queryset = FAQ.objects.all()
    serializer_class = FAQSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class SiteSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        settings = SiteSettings.objects.all()
        return Response({s.key: s.value for s in settings})


class AnnouncementBarView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        bar = AnnouncementBar.objects.filter(is_active=True).first()
        if bar:
            return Response(AnnouncementBarSerializer(bar).data)
        return Response({"messages": [], "is_active": False})
