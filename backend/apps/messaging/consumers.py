import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


async def _authenticate(token):
    import logging
    logger = logging.getLogger(__name__)
    if not token:
        logger.warning("WS auth: no token provided")
        return None
    try:
        access = AccessToken(token)
        user = await database_sync_to_async(User.objects.get)(pk=access["user_id"])
        logger.info(f"WS auth success: user={user.email}")
        return user
    except Exception as e:
        logger.warning(f"WS auth failed: {e}")
        return None


def _user_groups(user):
    """Return the channel-layer group names a user should be subscribed to."""
    groups = [f"inbox_user_{user.pk}"]
    try:
        vp = user.vendor_profile
        if vp:
            groups.append(f"inbox_vendor_{vp.pk}")
    except Exception:
        pass
    if user.is_staff:
        groups.append("inbox_staff")
    return groups


class ChatConsumer(AsyncWebsocketConsumer):
    """Per-conversation channel: ws/messaging/chat/<conv_id>/?token=…"""

    async def connect(self):
        self.conv_id = self.scope["url_route"]["kwargs"]["conv_id"]
        self.group_name = f"chat_{self.conv_id}"

        query = parse_qs(self.scope.get("query_string", b"").decode())
        token = (query.get("token") or [None])[0]
        self.user = await _authenticate(token)

        if not self.user:
            await self.close()
            return

        has_access = await self._check_access()
        if not has_access:
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def chat_read_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    @database_sync_to_async
    def _check_access(self):
        from .models import Conversation
        try:
            conv = Conversation.objects.select_related("vendor").get(pk=self.conv_id)
        except Conversation.DoesNotExist:
            return False
        if self.user.is_staff:
            return True
        if hasattr(self.user, "vendor_profile") and self.user.vendor_profile:
            return conv.vendor_id == self.user.vendor_profile.pk
        return conv.customer_id == self.user.pk


class NotificationConsumer(AsyncWebsocketConsumer):
    """Per-user notification channel: ws/messaging/notifications/?token=…"""

    async def connect(self):
        query = parse_qs(self.scope.get("query_string", b"").decode())
        token = (query.get("token") or [None])[0]
        self.user = await _authenticate(token)

        if not self.user:
            await self.close()
            return

        self.groups_list = _user_groups(self.user)
        for g in self.groups_list:
            await self.channel_layer.group_add(g, self.channel_name)

        await self.accept()

        unread = await self._get_unread_count()
        await self.send(text_data=json.dumps({
            "type": "unread_count",
            "unread_count": unread,
        }))

    async def disconnect(self, close_code):
        for g in getattr(self, "groups_list", []):
            await self.channel_layer.group_discard(g, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass

    async def inbox_notification(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def inbox_unread_update(self, event):
        unread = await self._get_unread_count()
        await self.send(text_data=json.dumps({
            "type": "unread_count",
            "unread_count": unread,
        }))

    @database_sync_to_async
    def _get_unread_count(self):
        from .models import Conversation
        user = self.user
        is_admin_side = user.is_staff or (
            hasattr(user, "vendor_profile") and user.vendor_profile is not None
        )
        if user.is_staff:
            qs = Conversation.objects.all()
        elif hasattr(user, "vendor_profile") and user.vendor_profile:
            qs = Conversation.objects.filter(vendor=user.vendor_profile)
        else:
            qs = Conversation.objects.filter(customer=user)

        from django.db.models import Count, Q
        unread_role = "customer" if is_admin_side else "admin"
        result = qs.aggregate(
            total=Count("messages", filter=Q(messages__read=False, messages__from_role=unread_role))
        )
        return result["total"] or 0
