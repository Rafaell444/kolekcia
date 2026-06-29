from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/products/", include("apps.products.urls")),
    path("api/orders/", include("apps.orders.urls")),
    path("api/auctions/", include("apps.auctions.urls")),
    path("api/gamification/", include("apps.gamification.urls")),
    path("api/promo/", include("apps.promo.urls")),
    path("api/cms/", include("apps.cms.urls")),
    path("api/messaging/", include("apps.messaging.urls")),
    path("api/newsletter/", include("apps.newsletter.urls")),
    path("api/contact/", include("apps.contact.urls")),
    path("api/tenants/", include("apps.tenants.urls")),
    path("api/vendors/", include("apps.vendors.urls")),
    path("api/admin/", include("apps.admin_api.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
