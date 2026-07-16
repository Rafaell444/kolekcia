from django.urls import re_path
from .consumers import ChatConsumer, NotificationConsumer

websocket_urlpatterns = [
    re_path(r"ws/messaging/notifications/$", NotificationConsumer.as_asgi()),
    re_path(r"ws/messaging/chat/(?P<conv_id>\d+)/$", ChatConsumer.as_asgi()),
]
