from rest_framework import serializers
from .models import EmailTemplate, EmailLog


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = (
            "id",
            "vendor",
            "event_key",
            "name",
            "subject",
            "html_body",
            "design_json",
            "variables",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class EmailTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (excludes heavy html_body / design_json)."""

    vendor_name = serializers.CharField(source="vendor.name", default="Platform", read_only=True)

    class Meta:
        model = EmailTemplate
        fields = (
            "id",
            "vendor",
            "vendor_name",
            "event_key",
            "name",
            "subject",
            "is_active",
            "updated_at",
        )


class EmailLogSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", default="—", read_only=True)

    class Meta:
        model = EmailLog
        fields = (
            "id",
            "template",
            "template_name",
            "recipient_email",
            "subject",
            "event_key",
            "status",
            "error_message",
            "sent_at",
        )
