from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.users.models import User


class PromoCode(models.Model):
    DISCOUNT_TYPE_CHOICES = [
        ("percent", "Percentage"),
        ("fixed", "Fixed Amount"),
    ]

    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES, default="percent")
    discount_value = models.DecimalField(max_digits=8, decimal_places=2)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    max_uses_per_user = models.PositiveIntegerField(null=True, blank=True)
    min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "promo_codes"

    def user_has_grant(self, user):
        if not user or not user.is_authenticated:
            return False
        return self.grants.filter(user=user).exists()

    def validate(self, user, order_value):
        if self.expires_at and self.expires_at < timezone.now():
            return "Promo code has expired."
        if order_value < self.min_order_value:
            return f"Minimum order value of ${self.min_order_value} required."
        has_grant = self.user_has_grant(user)
        if self.max_uses is not None and not has_grant:
            uses = self.usages.count()
            if uses >= self.max_uses:
                return "Promo code has reached its maximum uses."
        if self.max_uses_per_user is not None and user:
            user_uses = self.usages.filter(user=user).count()
            if user_uses >= self.max_uses_per_user:
                return "You have already used this promo code the maximum number of times."
        if not self.is_active and not has_grant:
            return "Invalid or expired promo code."
        return None

    def calculate_discount(self, subtotal):
        if self.discount_type == "percent":
            return (subtotal * self.discount_value / Decimal("100")).quantize(Decimal("0.01"))
        return min(self.discount_value, subtotal)

    def __str__(self):
        return self.code


class PromoCodeUsage(models.Model):
    promo = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name="usages")
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    order = models.ForeignKey("orders.Order", on_delete=models.SET_NULL, null=True, blank=True)
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "promo_code_usages"


class UserPromoGrant(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="promo_grants")
    promo = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name="grants")
    source_badge = models.ForeignKey(
        "gamification.Badge", on_delete=models.SET_NULL, null=True, blank=True, related_name="promo_grants"
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_promo_grants"
        unique_together = ("user", "promo", "source_badge")

    def __str__(self):
        return f"{self.user.email} — {self.promo.code}"
