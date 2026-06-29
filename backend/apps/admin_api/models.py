from django.db import models
from apps.users.models import User


class AuditLog(models.Model):
    admin_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="audit_logs")
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=50)
    target_id = models.CharField(max_length=100)
    detail = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.admin_user}: {self.action} on {self.target_type}#{self.target_id}"
