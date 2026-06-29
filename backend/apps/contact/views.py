from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework import serializers
from .models import ContactMessage


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("id", "reason", "first_name", "last_name", "email", "order_number", "message", "created_at")
        read_only_fields = ("id", "created_at")


class ContactCreateView(generics.CreateAPIView):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [AllowAny]
