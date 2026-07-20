from django.db import models


class EmailTemplate(models.Model):
    EVENT_CHOICES = [
        ("order_confirmed", "Order Confirmed"),
        ("order_shipped", "Order Shipped"),
        ("custom_order_shipped", "Custom Order Shipped"),
        ("auction_new", "New Auction Notification"),
        ("auction_won", "Auction Won"),
        ("password_reset", "Password Reset"),
        ("welcome", "Welcome / Registration"),
        ("custom", "Custom / One-off"),
    ]

    vendor = models.ForeignKey(
        "vendors.Vendor",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="email_templates",
        help_text="NULL = platform-wide template",
    )
    event_key = models.CharField(max_length=50, choices=EVENT_CHOICES)
    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=300)
    html_body = models.TextField(blank=True, help_text="Full HTML from the editor")
    design_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="GrapesJS project JSON for re-editing",
    )
    variables = models.JSONField(
        default=list,
        blank=True,
        help_text='Available placeholders, e.g. ["product_name","tracking_number"]',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "email_templates"
        unique_together = ("vendor", "event_key")
        ordering = ["-updated_at"]

    def __str__(self):
        vendor_label = self.vendor.name if self.vendor else "Platform"
        return f"[{vendor_label}] {self.name} ({self.event_key})"


class EmailLog(models.Model):
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_SENT, "Sent"),
        (STATUS_FAILED, "Failed"),
    ]

    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
    )
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=300)
    event_key = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SENT)
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "email_logs"
        ordering = ["-sent_at"]

    def __str__(self):
        return f"{self.recipient_email} — {self.event_key} ({self.status})"
