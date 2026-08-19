from django.db import models
from apps.users.models import User


class Conversation(models.Model):
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations")
    vendor = models.ForeignKey(
        "vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations"
    )
    subject = models.CharField(max_length=500)
    product = models.ForeignKey(
        "products.Product", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations"
    )
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
    SENDER_KIND_CHOICES = [
        ("customer", "Customer"),
        ("superadmin", "Superadmin"),
        ("vendor", "Vendor"),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    from_role = models.CharField(max_length=10, choices=FROM_CHOICES)
    sender_kind = models.CharField(max_length=12, choices=SENDER_KIND_CHOICES, default="customer")
    sender_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="sent_messages"
    )
    text = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="deleted_inbox_messages"
    )
    deletion_reason = models.TextField(blank=True)

    class Meta:
        db_table = "messages"
        ordering = ["sent_at"]

    def __str__(self):
        return f"{self.from_role} → {self.conversation.subject[:30]}"


class ChatRestriction(models.Model):
    CHANNEL_CHOICES = [("all", "All chat"), ("auction", "Auction chat"), ("inbox", "Inbox")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_restrictions")
    vendor = models.ForeignKey(
        "vendors.Vendor", on_delete=models.CASCADE, null=True, blank=True, related_name="chat_restrictions"
    )
    auction = models.ForeignKey(
        "auctions.Auction", on_delete=models.CASCADE, null=True, blank=True, related_name="chat_restrictions"
    )
    channel = models.CharField(max_length=12, choices=CHANNEL_CHOICES, default="all")
    is_banned = models.BooleanField(default=False)
    muted_until = models.DateTimeField(null=True, blank=True)
    requires_admin_review = models.BooleanField(default=False)
    strike_count = models.PositiveSmallIntegerField(default=0)
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_chat_restrictions"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_restrictions"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=("user", "channel")),
            models.Index(fields=("vendor", "channel")),
            models.Index(fields=("auction", "channel")),
        ]


class ChatReport(models.Model):
    STATUS_CHOICES = [("open", "Open"), ("resolved", "Resolved"), ("dismissed", "Dismissed")]
    TARGET_CHOICES = [("auction", "Auction message"), ("inbox", "Inbox message")]

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_reports")
    target_type = models.CharField(max_length=12, choices=TARGET_CHOICES)
    target_id = models.PositiveBigIntegerField()
    reported_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reported_chat_messages"
    )
    auction = models.ForeignKey(
        "auctions.Auction", on_delete=models.SET_NULL, null=True, blank=True, related_name="chat_reports"
    )
    vendor = models.ForeignKey(
        "vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="chat_reports"
    )
    reason = models.TextField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="open")
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_chat_reports"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_reports"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("reporter", "target_type", "target_id"), name="unique_chat_report_per_user"
            )
        ]


class RiskEvent(models.Model):
    OUTCOME_CHOICES = [("allowed", "Allowed"), ("rejected", "Rejected"), ("admin", "Admin action")]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="risk_events")
    auction = models.ForeignKey(
        "auctions.Auction", on_delete=models.SET_NULL, null=True, blank=True, related_name="risk_events"
    )
    vendor = models.ForeignKey(
        "vendors.Vendor", on_delete=models.SET_NULL, null=True, blank=True, related_name="risk_events"
    )
    event_type = models.CharField(max_length=40, db_index=True)
    outcome = models.CharField(max_length=12, choices=OUTCOME_CHOICES)
    reason = models.CharField(max_length=300, blank=True)
    ip_hash = models.CharField(max_length=64, blank=True, db_index=True)
    user_agent_hash = models.CharField(max_length=64, blank=True)
    device_hash = models.CharField(max_length=64, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "risk_events"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=("vendor", "event_type", "created_at"))]


class MessageAttachment(models.Model):
    MEDIA_CHOICES = [("image", "Image"), ("video", "Video"), ("file", "File")]

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="messaging/%Y/%m/")
    media_type = models.CharField(max_length=10, choices=MEDIA_CHOICES, default="file")
    original_name = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "message_attachments"

    def __str__(self):
        return f"{self.media_type}: {self.original_name}"
