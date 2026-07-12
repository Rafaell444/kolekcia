from django.urls import re_path
from .consumers import AuctionChatConsumer

websocket_urlpatterns = [
    re_path(r"ws/auctions/(?P<auction_id>\d+)/$", AuctionChatConsumer.as_asgi()),
]
