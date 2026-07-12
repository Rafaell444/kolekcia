from rest_framework import serializers
from .models import Conversation, Message, MessageAttachment


SHOP_LABELS = {
    "wallpanels": "Wallpanels",
    "figures": "Figures",
}


def shop_label_for_vendor(vendor):
    if not vendor:
        return None
    slug = getattr(vendor, "catalog_category_slug", "") or ""
    return SHOP_LABELS.get(slug, vendor.name)


class MessageAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = MessageAttachment
        fields = ("id", "url", "media_type", "original_name")

    def get_url(self, obj):
        request = self.context.get("request")
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else ""


class MessageSerializer(serializers.ModelSerializer):
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    sender_label = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ("id", "from_role", "sender_kind", "text", "sent_at", "read", "attachments", "sender_label")
        read_only_fields = ("id", "from_role", "sender_kind", "sent_at", "read", "sender_label")

    def get_sender_label(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        is_superadmin_viewer = request.user.is_staff and not (
            hasattr(request.user, "vendor_profile") and request.user.vendor_profile is not None
        )
        if not is_superadmin_viewer:
            return None
        if obj.sender_kind == "customer":
            return "Customer"
        if obj.sender_kind == "superadmin":
            return "Superadmin"
        if obj.sender_kind == "vendor":
            vendor = None
            if obj.sender_user and hasattr(obj.sender_user, "vendor_profile"):
                vendor = obj.sender_user.vendor_profile
            if not vendor and obj.conversation.vendor_id:
                vendor = obj.conversation.vendor
            return f"{shop_label_for_vendor(vendor)} shop" if vendor else "Vendor"
        return None


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    unread_count = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    customer_avatar = serializers.CharField(source="customer.avatar", read_only=True)
    vendor_id = serializers.IntegerField(source="vendor.id", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True, allow_null=True)
    shop_label = serializers.SerializerMethodField()
    product_id = serializers.IntegerField(source="product.id", read_only=True, allow_null=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True, allow_null=True)
    product_title = serializers.CharField(source="product.title", read_only=True, allow_null=True)
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id", "subject",
            "customer_name", "customer_email", "customer_avatar",
            "vendor_id", "vendor_name", "vendor_slug", "shop_label",
            "product_id", "product_slug", "product_title", "product_image_url",
            "unread_count", "messages", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_shop_label(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        is_superadmin_viewer = request.user.is_staff and not (
            hasattr(request.user, "vendor_profile") and request.user.vendor_profile is not None
        )
        if not is_superadmin_viewer:
            return None
        return shop_label_for_vendor(obj.vendor)

    def get_product_image_url(self, obj):
        if not obj.product:
            return None
        image = obj.product.images.first()
        return image.url if image else None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        user = request.user
        is_admin_side = user.is_staff or (
            hasattr(user, "vendor_profile") and user.vendor_profile is not None
        )
        if is_admin_side:
            return obj.messages.filter(read=False, from_role="customer").count()
        return obj.messages.filter(read=False, from_role="admin").count()
