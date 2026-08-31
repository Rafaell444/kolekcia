from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.throttling import ScopedRateThrottle
from .models import ContactMessage


class ContactThrottle(ScopedRateThrottle):
    scope = "contact"


class ContactMessageSerializer(serializers.ModelSerializer):
    reason = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    first_name = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    last_name = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    email = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    order_number = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    message = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)

    class Meta:
        model = ContactMessage
        fields = ("id", "reason", "first_name", "last_name", "email", "order_number", "message", "attachment", "created_at")
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        errors = {}

        for field, label in (("first_name", "First name"), ("last_name", "Last name")):
            value = str(attrs.get(field) or "").strip()
            if not value:
                errors[field] = [f"{label} is required."]
            else:
                attrs[field] = value

        email = str(attrs.get("email") or "").strip()
        if not email:
            errors["email"] = ["Email address is required."]
        else:
            try:
                validate_email(email)
            except DjangoValidationError:
                errors["email"] = ["Enter a valid email address."]
            else:
                attrs["email"] = email

        message = str(attrs.get("message") or "").strip()
        if not message:
            errors["message"] = ["Message is required."]
        elif len(message) < 15:
            errors["message"] = ["Message must be at least 15 characters."]
        else:
            attrs["message"] = message

        attrs["reason"] = str(attrs.get("reason") or "General Enquiry").strip() or "General Enquiry"
        attrs["order_number"] = str(attrs.get("order_number") or "").strip()

        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class ContactCreateView(generics.CreateAPIView):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ContactThrottle]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
