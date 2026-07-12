from django.urls import path
from .views import (
    HeroSlidesView, BannersView, FAQListView, SiteSettingsView, AnnouncementBarView,
    PageSectionsView, HomepageReviewListView, CommunitySocialLinkListView,
)

urlpatterns = [
    path("hero/", HeroSlidesView.as_view(), name="hero-slides"),
    path("banners/", BannersView.as_view(), name="banners"),
    path("faqs/", FAQListView.as_view(), name="faqs"),
    path("homepage-reviews/", HomepageReviewListView.as_view(), name="homepage-reviews"),
    path("community-links/", CommunitySocialLinkListView.as_view(), name="community-links"),
    path("settings/", SiteSettingsView.as_view(), name="site-settings"),
    path("pages/<str:page>/", PageSectionsView.as_view(), name="page-sections"),
    path("announcement/", AnnouncementBarView.as_view(), name="announcement-bar"),
]
