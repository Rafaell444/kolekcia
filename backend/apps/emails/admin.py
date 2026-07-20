from django.contrib import admin
from .models import EmailTemplate, EmailLog


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "event_key", "vendor", "is_active", "updated_at")
    list_filter = ("event_key", "is_active", "vendor")
    search_fields = ("name", "subject")
    ordering = ("-updated_at",)


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ("recipient_email", "event_key", "status", "sent_at")
    list_filter = ("status", "event_key")
    search_fields = ("recipient_email", "subject")
    ordering = ("-sent_at",)
    readonly_fields = ("template", "recipient_email", "subject", "event_key", "status", "error_message", "sent_at")
