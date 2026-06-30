from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("id", "from_role", "text", "sent_at", "read")
        read_only_fields = ("id", "from_role", "sent_at", "read")


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    unread_count = serializers.IntegerField(read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    customer_avatar = serializers.CharField(source="customer.avatar", read_only=True)
    vendor_id = serializers.IntegerField(source="vendor.id", read_only=True, allow_null=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True, allow_null=True)
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True, allow_null=True)
    product_id = serializers.IntegerField(source="product.id", read_only=True, allow_null=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True, allow_null=True)
    product_title = serializers.CharField(source="product.title", read_only=True, allow_null=True)
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id", "subject",
            "customer_name", "customer_email", "customer_avatar",
            "vendor_id", "vendor_name", "vendor_slug",
            "product_id", "product_slug", "product_title", "product_image_url",
            "unread_count", "messages", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_product_image_url(self, obj):
        if not obj.product:
            return None
        image = obj.product.images.first()
        return image.url if image else None
