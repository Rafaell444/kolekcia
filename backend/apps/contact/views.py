from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.throttling import ScopedRateThrottle
from .models import ContactMessage


class ContactThrottle(ScopedRateThrottle):
    scope = "contact"


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("id", "reason", "first_name", "last_name", "email", "order_number", "message", "attachment", "created_at")
        read_only_fields = ("id", "created_at")


class ContactCreateView(generics.CreateAPIView):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ContactThrottle]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
