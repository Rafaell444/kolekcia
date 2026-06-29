from django.urls import path
from .views import HeroSlidesView, BannersView, FAQListView, SiteSettingsView, AnnouncementBarView

urlpatterns = [
    path("hero/", HeroSlidesView.as_view(), name="hero-slides"),
    path("banners/", BannersView.as_view(), name="banners"),
    path("faqs/", FAQListView.as_view(), name="faqs"),
    path("settings/", SiteSettingsView.as_view(), name="site-settings"),
    path("announcement/", AnnouncementBarView.as_view(), name="announcement-bar"),
]
