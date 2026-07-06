from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsAdminOrVendor(BasePermission):
    """Allow staff admins OR authenticated vendor users."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.is_staff or hasattr(request.user, "vendor_profile")
