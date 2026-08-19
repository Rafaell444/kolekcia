from datetime import timedelta

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auctions.models import Auction, AuctionChatMessage
from apps.users.models import User
from apps.vendors.models import Vendor

from .models import ChatReport, ChatRestriction, Conversation, Message, RiskEvent


class ChatModerationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            email="moderator@example.com", password="test-password", is_staff=True
        )
        vendor_user = User.objects.create_user(email="vendor-chat@example.com", password="test-password")
        self.vendor = Vendor.objects.create(user=vendor_user, name="Chat Vendor", slug="chat-vendor")
        self.user = User.objects.create_user(email="chatter@example.com", password="test-password", name="Chatter")
        self.other = User.objects.create_user(email="reporter@example.com", password="test-password", name="Reporter")
        self.auction = Auction.objects.create(
            vendor=self.vendor,
            title="Live moderation auction",
            starting_bid="10.00",
            starts_at=timezone.now() - timedelta(minutes=5),
            ends_at=timezone.now() + timedelta(minutes=5),
            status=Auction.STATUS_ACTIVE,
        )

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def send_auction_messages(self, count, prefix):
        client = self.client_for(self.user)
        return [
            client.post(
                f"/api/auctions/{self.auction.slug}/chat/",
                {"text": f"{prefix} {index}"},
                format="json",
                HTTP_X_DEVICE_ID="qa-device",
                HTTP_X_FORWARDED_FOR="203.0.113.10",
            )
            for index in range(count)
        ]

    def test_sixth_message_mutes_for_thirty_seconds_then_five_minutes(self):
        responses = self.send_auction_messages(6, "burst-one")
        self.assertEqual([response.status_code for response in responses[:5]], [201] * 5)
        self.assertEqual(responses[5].status_code, 429)
        restriction = ChatRestriction.objects.get(user=self.user, auction=self.auction)
        self.assertEqual(restriction.strike_count, 1)
        self.assertGreater(restriction.muted_until, timezone.now())

        restriction.muted_until = timezone.now() - timedelta(seconds=1)
        restriction.save(update_fields=("muted_until",))
        cache.clear()
        responses = self.send_auction_messages(6, "burst-two")
        self.assertEqual(responses[5].status_code, 429)
        restriction.refresh_from_db()
        self.assertEqual(restriction.strike_count, 2)
        self.assertGreater(restriction.muted_until, timezone.now() + timedelta(minutes=4))

    def test_third_burst_requires_admin_review(self):
        for strike in range(3):
            if strike:
                restriction = ChatRestriction.objects.get(user=self.user, auction=self.auction)
                restriction.muted_until = timezone.now() - timedelta(seconds=1)
                restriction.save(update_fields=("muted_until",))
                cache.clear()
            responses = self.send_auction_messages(6, f"burst-{strike}")
            self.assertEqual(responses[5].status_code, 429)

        restriction.refresh_from_db()
        self.assertTrue(restriction.requires_admin_review)
        self.assertIsNone(restriction.muted_until)

    def test_duplicate_and_repeated_links_are_rejected(self):
        client = self.client_for(self.user)
        url = f"/api/auctions/{self.auction.slug}/chat/"
        self.assertEqual(client.post(url, {"text": "same text"}, format="json").status_code, 201)
        duplicate = client.post(url, {"text": " same   text "}, format="json")
        self.assertEqual(duplicate.status_code, 429)
        repeated_links = client.post(
            url,
            {"text": "https://example.com https://example.com"},
            format="json",
        )
        self.assertEqual(repeated_links.status_code, 429)

    def test_report_delete_and_unmute_keep_audit_history(self):
        message = AuctionChatMessage.objects.create(
            auction=self.auction, user=self.user, text="Reportable message"
        )
        reporter_client = self.client_for(self.other)
        report_response = reporter_client.post(
            "/api/messaging/reports/",
            {"target_type": "auction", "target_id": message.pk, "reason": "Spam"},
            format="json",
        )
        self.assertEqual(report_response.status_code, 201)
        self.assertTrue(ChatReport.objects.filter(target_id=message.pk, status="open").exists())

        admin_client = self.client_for(self.admin)
        delete_response = admin_client.post(
            f"/api/messaging/moderation/messages/auction/{message.pk}/delete/",
            {"reason": "Confirmed spam"},
            format="json",
        )
        self.assertEqual(delete_response.status_code, 200)
        message.refresh_from_db()
        self.assertTrue(message.is_deleted)
        self.assertEqual(delete_response.data["text"], "Message removed by a moderator.")

        restriction_response = admin_client.post(
            "/api/messaging/moderation/restrictions/",
            {
                "user_id": str(self.user.pk),
                "auction_id": self.auction.pk,
                "channel": "auction",
                "duration_seconds": 300,
                "reason": "Confirmed spam",
            },
            format="json",
        )
        restriction_id = restriction_response.data["id"]
        self.assertEqual(restriction_response.status_code, 201)
        self.assertEqual(
            admin_client.delete(f"/api/messaging/moderation/restrictions/{restriction_id}/").status_code,
            204,
        )
        self.assertTrue(RiskEvent.objects.filter(event_type="chat_admin_unmute").exists())

    def test_inbox_uses_same_protection_and_reports(self):
        conversation = Conversation.objects.create(
            customer=self.user, vendor=self.vendor, subject="Inbox moderation"
        )
        client = self.client_for(self.user)
        statuses = [
            client.post(
                f"/api/messaging/conversations/{conversation.pk}/messages/",
                {"text": f"Inbox burst {index}"},
                format="json",
            ).status_code
            for index in range(6)
        ]
        self.assertEqual(statuses[:5], [201] * 5)
        self.assertEqual(statuses[5], 429)
        self.assertTrue(ChatRestriction.objects.filter(user=self.user, channel="inbox").exists())

    def test_customer_attachment_count_size_type_and_signature_limits(self):
        conversation = Conversation.objects.create(
            customer=self.user, vendor=self.vendor, subject="Attachment security"
        )
        client = self.client_for(self.user)
        url = f"/api/messaging/conversations/{conversation.pk}/messages/"

        tiny_png = b"\x89PNG\r\n\x1a\n" + b"0" * 20
        too_many = client.post(
            url,
            {"files": [
                SimpleUploadedFile(f"image-{index}.png", tiny_png, content_type="image/png")
                for index in range(4)
            ]},
            format="multipart",
        )
        self.assertEqual(too_many.status_code, 400)
        self.assertIn("up to 3 files", too_many.data["detail"])

        wrong_type = client.post(
            url,
            {"files": SimpleUploadedFile("payload.exe", b"MZ", content_type="application/octet-stream")},
            format="multipart",
        )
        self.assertEqual(wrong_type.status_code, 400)
        self.assertIn("Only JPEG", wrong_type.data["detail"])

        disguised = client.post(
            url,
            {"files": SimpleUploadedFile("fake.png", b"not a png", content_type="image/png")},
            format="multipart",
        )
        self.assertEqual(disguised.status_code, 400)
        self.assertIn("does not match", disguised.data["detail"])
        self.assertEqual(Message.objects.filter(conversation=conversation).count(), 0)
        self.assertEqual(
            RiskEvent.objects.filter(event_type="inbox_attachment_rejected").count(), 3
        )

    def test_valid_customer_attachment_is_saved(self):
        conversation = Conversation.objects.create(
            customer=self.user, vendor=self.vendor, subject="Valid attachment"
        )
        response = self.client_for(self.user).post(
            f"/api/messaging/conversations/{conversation.pk}/messages/",
            {
                "files": SimpleUploadedFile(
                    "valid.png", b"\x89PNG\r\n\x1a\n" + b"0" * 20, content_type="image/png"
                )
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["attachments"][0]["media_type"], "image")

    def test_risk_signals_are_hashed(self):
        client = self.client_for(self.user)
        client.post(
            f"/api/auctions/{self.auction.slug}/chat/",
            {"text": "Hash my risk signals"},
            format="json",
            HTTP_X_DEVICE_ID="raw-device-value",
            HTTP_X_FORWARDED_FOR="203.0.113.99",
            HTTP_USER_AGENT="QA Browser",
        )
        event = RiskEvent.objects.filter(event_type="chat_message").latest("created_at")
        self.assertNotEqual(event.ip_hash, "203.0.113.99")
        self.assertNotEqual(event.device_hash, "raw-device-value")
        self.assertEqual(len(event.ip_hash), 64)
        self.assertEqual(len(event.device_hash), 64)


class AuthenticationRiskTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email="login-risk@example.com", password="valid-password")

    def test_failed_login_is_recorded_without_raw_credentials(self):
        response = APIClient().post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "wrong-password"},
            format="json",
            HTTP_X_FORWARDED_FOR="198.51.100.22",
        )
        self.assertEqual(response.status_code, 400)
        event = RiskEvent.objects.get(event_type="login_failed")
        self.assertEqual(event.user, self.user)
        self.assertNotIn("wrong-password", str(event.metadata))
        self.assertNotEqual(event.ip_hash, "198.51.100.22")
