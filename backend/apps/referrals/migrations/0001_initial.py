from django.db import migrations, models
import django.db.models.deletion
import apps.referrals.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReferralProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(default=apps.referrals.models.generate_referral_code, max_length=32, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="referral_profile", to="users.user")),
            ],
            options={"db_table": "referral_profiles"},
        ),
        migrations.CreateModel(
            name="ReferralInvite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32)),
                ("claimed_at", models.DateTimeField(auto_now_add=True)),
                ("converted_at", models.DateTimeField(blank=True, null=True)),
                ("invitee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_referrals", to="users.user")),
                ("inviter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sent_referrals", to="users.user")),
            ],
            options={"db_table": "referral_invites", "unique_together": {("inviter", "invitee")}},
        ),
    ]
