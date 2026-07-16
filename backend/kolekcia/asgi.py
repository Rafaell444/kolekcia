import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kolekcia.settings.local")

django_asgi_app = get_asgi_application()

from apps.auctions.routing import websocket_urlpatterns as auction_ws  # noqa: E402
from apps.messaging.routing import websocket_urlpatterns as messaging_ws  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(URLRouter(auction_ws + messaging_ws)),
})
