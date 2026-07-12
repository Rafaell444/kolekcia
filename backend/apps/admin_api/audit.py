from .models import AuditLog


def log_action(admin_user, action, target_type, target_id, detail=None):
    AuditLog.objects.create(
        admin_user=admin_user,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        detail=detail or {},
    )
