from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message, MessageAttachment
from .serializers import ConversationSerializer, MessageSerializer


def _is_vendor(user):
    return hasattr(user, "vendor_profile") and user.vendor_profile is not None


def _message_sender_meta(user):
    if _is_vendor(user):
        return "admin", "vendor", user
    if user.is_staff:
        return "admin", "superadmin", user
    return "customer", "customer", user


def _create_message(conversation, user, text=""):
    from_role, sender_kind, sender_user = _message_sender_meta(user)
    return Message.objects.create(
        conversation=conversation,
        from_role=from_role,
        sender_kind=sender_kind,
        sender_user=sender_user if sender_kind != "customer" else user,
        text=text,
    )


def _broadcast_new_message(conv, msg, request=None):
    """Push a new-message event to the chat group and unread notifications to participants."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        send = async_to_sync(channel_layer.group_send)

        msg_data = MessageSerializer(msg, context={"request": request}).data if request else {
            "id": msg.pk,
            "from_role": msg.from_role,
            "sender_kind": msg.sender_kind,
            "text": msg.text,
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else "",
            "read": msg.read,
            "attachments": [],
        }

        send(f"chat_{conv.pk}", {
            "type": "chat_message",
            "data": {"type": "new_message", "conversation_id": conv.pk, "message": msg_data},
        })

        send(f"inbox_user_{conv.customer_id}", {
            "type": "inbox_unread_update",
            "data": {"conversation_id": conv.pk},
        })

        if conv.vendor_id:
            send(f"inbox_vendor_{conv.vendor_id}", {
                "type": "inbox_unread_update",
                "data": {"conversation_id": conv.pk},
            })

        send("inbox_staff", {
            "type": "inbox_unread_update",
            "data": {"conversation_id": conv.pk},
        })
    except Exception:
        pass


def _broadcast_read_update(conv, reader_user):
    """Notify chat participants that messages were marked as read."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        send = async_to_sync(channel_layer.group_send)

        send(f"chat_{conv.pk}", {
            "type": "chat_read_update",
            "data": {"type": "read_update", "conversation_id": conv.pk, "reader_user_id": str(reader_user.pk)},
        })

        send(f"inbox_user_{conv.customer_id}", {
            "type": "inbox_unread_update",
            "data": {"conversation_id": conv.pk},
        })
        if conv.vendor_id:
            send(f"inbox_vendor_{conv.vendor_id}", {
                "type": "inbox_unread_update",
                "data": {"conversation_id": conv.pk},
            })
        send("inbox_staff", {
            "type": "inbox_unread_update",
            "data": {"conversation_id": conv.pk},
        })
    except Exception:
        pass


class ConversationListView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Conversation.objects.prefetch_related(
            "messages__attachments", "product__images"
        ).select_related("vendor", "product")
        if self.request.user.is_staff:
            return qs.all()
        if _is_vendor(self.request.user):
            return qs.filter(vendor=self.request.user.vendor_profile)
        return qs.filter(customer=self.request.user)

    def perform_create(self, serializer):
        vendor_id = self.request.data.get("vendor_id")
        product_id = self.request.data.get("product_id")
        vendor = None
        product = None
        if vendor_id:
            try:
                from apps.vendors.models import Vendor
                vendor = Vendor.objects.get(pk=vendor_id)
            except Exception:
                pass
        if product_id:
            try:
                from apps.products.models import Product
                product = Product.objects.select_related("vendor", "artist").get(pk=product_id)
                if not vendor and product.vendor_id:
                    vendor = product.vendor
                elif not vendor and product.artist and product.artist.vendor_id:
                    vendor = product.artist.vendor
            except Exception:
                product = None
        subject = self.request.data.get("subject", "").strip()
        if product:
            subject = f'Regarding "{product.title}"'
        elif not subject:
            subject = "New conversation"
        conv = serializer.save(customer=self.request.user, vendor=vendor, product=product, subject=subject)
        text = self.request.data.get("initial_message", "")
        if text:
            msg = _create_message(conv, self.request.user, text)
            _broadcast_new_message(conv, msg, self.request)


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Conversation.objects.prefetch_related(
            "messages__attachments", "product__images"
        ).select_related("vendor", "product")
        if self.request.user.is_staff:
            return qs.all()
        if _is_vendor(self.request.user):
            return qs.filter(vendor=self.request.user.vendor_profile)
        return qs.filter(customer=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_staff or _is_vendor(request.user):
            updated = Message.objects.filter(
                conversation=instance, from_role="customer", read=False
            ).update(read=True)
        else:
            updated = Message.objects.filter(
                conversation=instance, from_role="admin", read=False
            ).update(read=True)
        if updated:
            _broadcast_read_update(instance, request.user)
        if getattr(instance, "_prefetched_objects_cache", None):
            instance._prefetched_objects_cache.pop("messages", None)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        is_admin_side = request.user.is_staff or _is_vendor(request.user)
        try:
            if is_admin_side:
                if _is_vendor(request.user):
                    conv = Conversation.objects.get(pk=pk, vendor=request.user.vendor_profile)
                else:
                    conv = Conversation.objects.get(pk=pk)
            else:
                conv = Conversation.objects.get(pk=pk, customer=request.user)
        except Conversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        from_role, sender_kind, sender_user = _message_sender_meta(request.user)
        text = request.data.get("text", "").strip()
        files = request.FILES.getlist("files")

        if not text and not files:
            return Response({"detail": "Message text or attachment is required."}, status=status.HTTP_400_BAD_REQUEST)

        msg = Message.objects.create(
            conversation=conv,
            from_role=from_role,
            sender_kind=sender_kind,
            sender_user=sender_user if sender_kind != "customer" else request.user,
            text=text,
        )

        for f in files:
            mime = f.content_type or ""
            if mime.startswith("image/"):
                media_type = "image"
            elif mime.startswith("video/"):
                media_type = "video"
            else:
                media_type = "file"
            MessageAttachment.objects.create(
                message=msg,
                file=f,
                media_type=media_type,
                original_name=f.name,
            )

        conv.save()
        _broadcast_new_message(conv, msg, request)
        return Response(MessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)


class StartConversationWithCustomerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.users.models import User
        from apps.vendors.models import Vendor

        customer_id = request.data.get("customer_id")
        if not customer_id:
            return Response({"detail": "customer_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = User.objects.get(pk=customer_id)
        except User.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)

        vendor = None
        if _is_vendor(request.user):
            vendor = request.user.vendor_profile
        elif request.user.is_staff and request.data.get("vendor_id"):
            try:
                vendor = Vendor.objects.get(pk=request.data["vendor_id"])
            except Vendor.DoesNotExist:
                pass
        elif not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        subject = (request.data.get("subject") or "").strip()
        if not subject:
            subject = f"Message from {vendor.name}" if vendor else "Support message"

        conv = Conversation.objects.filter(customer=customer, vendor=vendor).order_by("-updated_at").first()
        created = False
        if not conv:
            conv = Conversation.objects.create(customer=customer, vendor=vendor, subject=subject)
            created = True

        initial = (request.data.get("initial_message") or "").strip()
        if initial:
            msg = _create_message(conv, request.user, initial)
            _broadcast_new_message(conv, msg, request)

        return Response(
            ConversationSerializer(conv, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q
        user = request.user
        is_admin_side = user.is_staff or _is_vendor(user)
        if user.is_staff:
            qs = Conversation.objects.all()
        elif _is_vendor(user):
            qs = Conversation.objects.filter(vendor=user.vendor_profile)
        else:
            qs = Conversation.objects.filter(customer=user)
        unread_role = "customer" if is_admin_side else "admin"
        result = qs.aggregate(
            total=Count("messages", filter=Q(messages__read=False, messages__from_role=unread_role))
        )
        return Response({"unread_count": result["total"] or 0})
