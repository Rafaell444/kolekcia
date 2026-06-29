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

    class Meta:
        model = Conversation
        fields = (
            "id", "subject",
            "customer_name", "customer_email", "customer_avatar",
            "vendor_id", "vendor_name", "vendor_slug",
            "unread_count", "messages", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
