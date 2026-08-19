from rest_framework import generics, status
from datetime import timedelta
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ChatReport,
    ChatRestriction,
    Conversation,
    Message,
    MessageAttachment,
    RiskEvent,
)
from .serializers import ConversationSerializer, MessageSerializer
from .moderation import enforce_message, log_risk_event
from .attachment_security import record_customer_attachments, validate_customer_attachments


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
        text = self.request.data.get("initial_message", "").strip()
        decision = enforce_message(
            self.request.user,
            text or subject,
            "inbox",
            vendor=vendor,
            source=self.request,
        )
        if not decision.allowed:
            from rest_framework.exceptions import Throttled

            raise Throttled(wait=decision.retry_after, detail=decision.detail)
        conv = serializer.save(customer=self.request.user, vendor=vendor, product=product, subject=subject)
        if text:
            msg = _create_message(conv, self.request.user, text)
            log_risk_event(
                "inbox_message", "allowed", user=self.request.user, vendor=vendor,
                source=self.request, metadata={"conversation_id": conv.pk},
            )
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

        if files and not is_admin_side:
            attachment_decision = validate_customer_attachments(request.user, files)
            if not attachment_decision.allowed:
                log_risk_event(
                    "inbox_attachment_rejected", "rejected", user=request.user, vendor=conv.vendor,
                    source=request, reason=attachment_decision.detail,
                    metadata={"conversation_id": conv.pk, "file_count": len(files)},
                )
                return Response(
                    {"detail": attachment_decision.detail}, status=status.HTTP_400_BAD_REQUEST
                )

        decision = enforce_message(
            request.user,
            text or "[attachment]",
            "inbox",
            vendor=conv.vendor,
            source=request,
        )
        if not decision.allowed:
            response = Response(
                {"detail": decision.detail, "retry_after": decision.retry_after},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            if decision.retry_after:
                response["Retry-After"] = str(decision.retry_after)
            return response

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

        if files and not is_admin_side:
            record_customer_attachments(request.user, files)

        conv.save()
        log_risk_event(
            "inbox_message", "allowed", user=request.user, vendor=conv.vendor,
            source=request, metadata={"conversation_id": conv.pk},
        )
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


def _moderator_vendor(user):
    return user.vendor_profile if _is_vendor(user) and not user.is_staff else None


def _can_moderate_vendor(user, vendor_id):
    vendor = _moderator_vendor(user)
    return user.is_staff or (vendor is not None and vendor.pk == vendor_id)


def _target_message(target_type, target_id):
    if target_type == "auction":
        from apps.auctions.models import AuctionChatMessage

        message = AuctionChatMessage.objects.select_related("user", "auction__vendor").filter(pk=target_id).first()
        if not message:
            return None, None, None
        return message, message.user, message.auction
    if target_type == "inbox":
        message = Message.objects.select_related("sender_user", "conversation__customer", "conversation__vendor").filter(pk=target_id).first()
        if not message:
            return None, None, None
        reported_user = message.sender_user or message.conversation.customer
        return message, reported_user, None
    return None, None, None


class ChatReportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target_type = (request.data.get("target_type") or "").strip()
        target_id = request.data.get("target_id")
        reason = (request.data.get("reason") or "").strip()
        if target_type not in ("auction", "inbox") or not target_id or not reason:
            return Response(
                {"detail": "target_type, target_id, and reason are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message, reported_user, auction = _target_message(target_type, target_id)
        if not message or getattr(message, "is_deleted", False):
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)
        if reported_user == request.user:
            return Response({"detail": "You cannot report your own message."}, status=status.HTTP_400_BAD_REQUEST)

        vendor = auction.vendor if auction else message.conversation.vendor
        if target_type == "inbox":
            conv = message.conversation
            allowed = request.user.is_staff or conv.customer_id == request.user.pk or (
                _is_vendor(request.user) and conv.vendor_id == request.user.vendor_profile.pk
            )
            if not allowed:
                return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        report, created = ChatReport.objects.get_or_create(
            reporter=request.user,
            target_type=target_type,
            target_id=target_id,
            defaults={
                "reported_user": reported_user,
                "auction": auction,
                "vendor": vendor,
                "reason": reason,
            },
        )
        if not created:
            return Response({"detail": "You already reported this message."}, status=status.HTTP_409_CONFLICT)
        log_risk_event(
            "chat_report", "allowed", user=request.user, auction=auction, vendor=vendor,
            source=request, reason=reason, metadata={"target_type": target_type, "target_id": target_id},
        )
        return Response({"id": report.pk, "status": report.status}, status=status.HTTP_201_CREATED)


class ModerationBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_staff and not _is_vendor(request.user):
            self.permission_denied(request)


class ChatRestrictionListView(ModerationBaseView):
    def get(self, request):
        queryset = ChatRestriction.objects.select_related("user", "vendor", "auction", "created_by")
        vendor = _moderator_vendor(request.user)
        if vendor:
            queryset = queryset.filter(vendor=vendor)
        data = [
            {
                "id": item.pk,
                "user_id": str(item.user_id),
                "user_email": item.user.email,
                "vendor_id": item.vendor_id,
                "vendor_name": item.vendor.name if item.vendor else None,
                "auction_id": item.auction_id,
                "auction_title": item.auction.title if item.auction else None,
                "channel": item.channel,
                "is_banned": item.is_banned,
                "muted_until": item.muted_until,
                "requires_admin_review": item.requires_admin_review,
                "strike_count": item.strike_count,
                "reason": item.reason,
                "updated_at": item.updated_at,
            }
            for item in queryset[:300]
        ]
        return Response(data)

    def post(self, request):
        user_id = request.data.get("user_id")
        email = (request.data.get("user_email") or "").strip().lower()
        user = get_user_model().objects.filter(pk=user_id).first() if user_id else None
        user = user or (get_user_model().objects.filter(email__iexact=email).first() if email else None)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        auction = None
        vendor = _moderator_vendor(request.user)
        auction_id = request.data.get("auction_id")
        vendor_id = request.data.get("vendor_id")
        if auction_id:
            from apps.auctions.models import Auction

            auction = Auction.objects.select_related("vendor").filter(pk=auction_id).first()
            if not auction or not _can_moderate_vendor(request.user, auction.vendor_id):
                return Response({"detail": "Auction not found."}, status=status.HTTP_404_NOT_FOUND)
            vendor = auction.vendor
        elif vendor_id and request.user.is_staff:
            from apps.vendors.models import Vendor

            vendor = Vendor.objects.filter(pk=vendor_id).first()

        channel = request.data.get("channel") or "all"
        if channel not in ("all", "auction", "inbox"):
            return Response({"detail": "Invalid channel."}, status=status.HTTP_400_BAD_REQUEST)
        duration = request.data.get("duration_seconds")
        is_banned = bool(request.data.get("is_banned"))
        review = bool(request.data.get("requires_admin_review"))
        muted_until = timezone.now() + timedelta(seconds=int(duration)) if duration else None
        restriction = ChatRestriction.objects.create(
            user=user,
            vendor=vendor,
            auction=auction,
            channel=channel,
            is_banned=is_banned,
            muted_until=muted_until,
            requires_admin_review=review,
            reason=(request.data.get("reason") or "Manual moderation action.").strip(),
            created_by=request.user,
        )
        log_risk_event(
            "chat_admin_restriction", "admin", user=user, auction=auction, vendor=vendor,
            source=request, reason=restriction.reason,
            metadata={"channel": channel, "is_banned": is_banned, "duration_seconds": duration},
        )
        return Response({"id": restriction.pk}, status=status.HTTP_201_CREATED)


class ChatRestrictionDetailView(ModerationBaseView):
    def delete(self, request, pk):
        restriction = ChatRestriction.objects.select_related("user", "vendor", "auction").filter(pk=pk).first()
        if not restriction or not _can_moderate_vendor(request.user, restriction.vendor_id):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        log_risk_event(
            "chat_admin_unmute", "admin", user=restriction.user, auction=restriction.auction,
            vendor=restriction.vendor, source=request, reason=(request.data.get("reason") or "Restriction removed."),
        )
        restriction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatReportListView(ModerationBaseView):
    def get(self, request):
        queryset = ChatReport.objects.select_related("reporter", "reported_user", "vendor", "auction")
        vendor = _moderator_vendor(request.user)
        if vendor:
            queryset = queryset.filter(vendor=vendor)
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return Response([
            {
                "id": item.pk,
                "target_type": item.target_type,
                "target_id": item.target_id,
                "reporter_email": item.reporter.email,
                "reported_user_id": str(item.reported_user_id) if item.reported_user_id else None,
                "reported_user_email": item.reported_user.email if item.reported_user else None,
                "vendor_id": item.vendor_id,
                "vendor_name": item.vendor.name if item.vendor else None,
                "auction_id": item.auction_id,
                "auction_title": item.auction.title if item.auction else None,
                "reason": item.reason,
                "status": item.status,
                "created_at": item.created_at,
            }
            for item in queryset[:300]
        ])

    def patch(self, request, pk):
        report = ChatReport.objects.select_related("vendor", "auction", "reported_user").filter(pk=pk).first()
        if not report or not _can_moderate_vendor(request.user, report.vendor_id):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        new_status = request.data.get("status")
        if new_status not in ("resolved", "dismissed"):
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        report.status = new_status
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save(update_fields=("status", "reviewed_by", "reviewed_at"))
        log_risk_event(
            "chat_report_review", "admin", user=report.reported_user, auction=report.auction,
            vendor=report.vendor, source=request, reason=new_status,
        )
        return Response({"id": report.pk, "status": report.status})


class ModeratedMessageDeleteView(ModerationBaseView):
    def post(self, request, target_type, target_id):
        message, author, auction = _target_message(target_type, target_id)
        if not message:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)
        vendor = auction.vendor if auction else message.conversation.vendor
        if not _can_moderate_vendor(request.user, vendor.pk if vendor else None):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        message.is_deleted = True
        message.deleted_at = timezone.now()
        message.deleted_by = request.user
        message.deletion_reason = (request.data.get("reason") or "Removed by moderator.").strip()
        message.save(update_fields=("is_deleted", "deleted_at", "deleted_by", "deletion_reason"))
        log_risk_event(
            "chat_message_deleted", "admin", user=author, auction=auction, vendor=vendor,
            source=request, reason=message.deletion_reason,
            metadata={"target_type": target_type, "target_id": target_id},
        )
        if target_type == "inbox":
            _broadcast_new_message(message.conversation, message, request)
            payload = MessageSerializer(message, context={"request": request}).data
        else:
            from apps.auctions.serializers import AuctionChatMessageSerializer
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer

            payload = AuctionChatMessageSerializer(message).data
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"auction_{auction.pk}", {"type": "chat_message", "message": payload}
                )
        return Response(payload)


class RiskEventListView(ModerationBaseView):
    def get(self, request):
        queryset = RiskEvent.objects.select_related("user", "vendor", "auction")
        vendor = _moderator_vendor(request.user)
        if vendor:
            queryset = queryset.filter(vendor=vendor)
        event_type = request.query_params.get("event_type")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        return Response([
            {
                "id": item.pk,
                "event_type": item.event_type,
                "outcome": item.outcome,
                "user_email": item.user.email if item.user else None,
                "auction_title": item.auction.title if item.auction else None,
                "vendor_name": item.vendor.name if item.vendor else None,
                "reason": item.reason,
                "ip_hash": item.ip_hash[:12] if item.ip_hash else "",
                "device_hash": item.device_hash[:12] if item.device_hash else "",
                "metadata": item.metadata,
                "created_at": item.created_at,
            }
            for item in queryset[:500]
        ])
