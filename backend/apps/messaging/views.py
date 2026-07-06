from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message, MessageAttachment
from .serializers import ConversationSerializer, MessageSerializer


def _is_vendor(user):
    return hasattr(user, "vendor_profile") and user.vendor_profile is not None


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
            Message.objects.create(conversation=conv, from_role="customer", text=text)


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
            Message.objects.filter(
                conversation=instance, from_role="customer", read=False
            ).update(read=True)
        else:
            Message.objects.filter(
                conversation=instance, from_role="admin", read=False
            ).update(read=True)
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

        from_role = "admin" if is_admin_side else "customer"
        text = request.data.get("text", "").strip()
        files = request.FILES.getlist("files")

        if not text and not files:
            return Response({"detail": "Message text or attachment is required."}, status=status.HTTP_400_BAD_REQUEST)

        msg = Message.objects.create(conversation=conv, from_role=from_role, text=text)

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
        return Response(MessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)
