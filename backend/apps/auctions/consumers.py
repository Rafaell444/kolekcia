import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.ws_auth import extract_ws_token, preferred_ws_subprotocol

User = get_user_model()


class AuctionChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.auction_id = self.scope["url_route"]["kwargs"]["auction_id"]
        self.group_name = f"auction_{self.auction_id}"

        token = extract_ws_token(self.scope)
        self.user = await self._authenticate(token)

        if not self.user:
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        subprotocol = preferred_ws_subprotocol(self.scope)
        await self.accept(subprotocol=subprotocol)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            return

        text = (payload.get("text") or "").strip()
        if not text:
            return

        message = await self._save_message(text)
        if not message:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat_message", "message": message},
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["message"]))

    @database_sync_to_async
    def _authenticate(self, token):
        if not token:
            return None
        try:
            access = AccessToken(token)
            return User.objects.get(pk=access["user_id"])
        except Exception:
            return None

    @database_sync_to_async
    def _save_message(self, text):
        from apps.auctions.models import Auction, AuctionChatMessage
        from apps.auctions.serializers import AuctionChatMessageSerializer

        try:
            auction = Auction.objects.get(pk=self.auction_id)
        except Auction.DoesNotExist:
            return None

        if not auction.is_biddable():
            return None

        msg = AuctionChatMessage.objects.create(auction=auction, user=self.user, text=text)
        return AuctionChatMessageSerializer(msg).data
