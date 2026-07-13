from django.db import models


class ContactMessage(models.Model):
    reason = models.CharField(max_length=100)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    order_number = models.CharField(max_length=50, blank=True)
    message = models.TextField()
    attachment = models.ImageField(upload_to="contact_attachments/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_messages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.email}: {self.reason}"
