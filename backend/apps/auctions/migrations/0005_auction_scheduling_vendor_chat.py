from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("vendors", "0005_vendor_merchant_id"),
        ("auctions", "0004_auction_slug"),
    ]

    operations = [
        migrations.AddField(
            model_name="auction",
            name="starts_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="auction",
            name="status",
            field=models.CharField(
                choices=[("inactive", "Inactive"), ("active", "Active"), ("bought", "Bought")],
                default="active",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="auction",
            name="vendor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="auctions",
                to="vendors.vendor",
            ),
        ),
        migrations.AddField(
            model_name="auction",
            name="winning_amount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="auction",
            name="winner_payment_status",
            field=models.CharField(
                blank=True,
                choices=[("pending", "Pending"), ("paid", "Paid"), ("failed", "Failed")],
                default="",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="auction",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="AuctionChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.CharField(max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "auction",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chat_messages",
                        to="auctions.auction",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="auction_chat_messages",
                        to="users.user",
                    ),
                ),
            ],
            options={
                "db_table": "auction_chat_messages",
                "ordering": ["created_at"],
            },
        ),
    ]
