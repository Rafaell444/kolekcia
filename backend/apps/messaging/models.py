from django.db import models
from apps.users.models import User


class Conversation(models.Model):
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations")
    vendor = models.ForeignKey(
        "vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations"
    )
    subject = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "conversations"
        ordering = ["-updated_at"]

    @property
    def unread_count(self):
        return self.messages.filter(read=False, from_role="customer").count()

    def __str__(self):
        return f"{self.customer.email}: {self.subject}"


class Message(models.Model):
    FROM_CHOICES = [("customer", "Customer"), ("admin", "Admin")]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    from_role = models.CharField(max_length=10, choices=FROM_CHOICES)
    text = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

    class Meta:
        db_table = "messages"
        ordering = ["sent_at"]

    def __str__(self):
        return f"{self.from_role} → {self.conversation.subject[:30]}"
