from django.db import models
from apps.users.models import User


class XPRule(models.Model):
    action_key = models.CharField(max_length=50, unique=True)
    xp_amount = models.PositiveIntegerField(default=10)
    is_one_time = models.BooleanField(default=False)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "xp_rules"

    def __str__(self):
        return f"{self.action_key}: {self.xp_amount} XP"


class GamificationProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="gamification")
    xp = models.PositiveIntegerField(default=0)
    points = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=1)
    streak_days = models.PositiveIntegerField(default=0)
    last_active = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "gamification_profiles"

    def recalculate_level(self):
        xp = self.xp
        if xp >= 10000:
            self.level = 10
        elif xp >= 5000:
            self.level = 9
        elif xp >= 3000:
            self.level = 8
        elif xp >= 2000:
            self.level = 7
        elif xp >= 1500:
            self.level = 6
        elif xp >= 1000:
            self.level = 5
        elif xp >= 700:
            self.level = 4
        elif xp >= 400:
            self.level = 3
        elif xp >= 150:
            self.level = 2
        else:
            self.level = 1

    def __str__(self):
        return f"{self.user.email} — L{self.level} ({self.xp} XP)"


class XPLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="xp_logs")
    action = models.CharField(max_length=50)
    xp_amount = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "xp_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email}: {self.action} +{self.xp_amount}"


class Badge(models.Model):
    RARITY_CHOICES = [
        ("common", "Common"),
        ("rare", "Rare"),
        ("epic", "Epic"),
        ("legendary", "Legendary"),
    ]

    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=10)
    rarity = models.CharField(max_length=20, choices=RARITY_CHOICES, default="common")
    description = models.TextField()
    trigger_action = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "badges"

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="badges")
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_badges"
        unique_together = ("user", "badge")
