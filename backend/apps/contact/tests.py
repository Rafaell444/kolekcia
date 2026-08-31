from django.test import TestCase, override_settings

from apps.contact.models import ContactMessage


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [],
        "DEFAULT_THROTTLE_RATES": {"contact": "1000/min"},
    }
)
class ContactMessageValidationTests(TestCase):
    def test_rejects_whitespace_and_short_message_with_field_errors(self):
        response = self.client.post(
            "/api/contact/",
            {
                "reason": "General Enquiry",
                "first_name": "   ",
                "last_name": "\t",
                "email": "not-an-email",
                "message": "too short",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("first_name", response.json())
        self.assertIn("last_name", response.json())
        self.assertIn("email", response.json())
        self.assertIn("message", response.json())
        self.assertFalse(ContactMessage.objects.exists())

    def test_trims_valid_contact_message_before_saving(self):
        response = self.client.post(
            "/api/contact/",
            {
                "reason": "  Shipping & Tracking  ",
                "first_name": "  Nino  ",
                "last_name": "  Beridze  ",
                "email": "  nino@example.com  ",
                "order_number": "  ORD-123  ",
                "message": "  Please help me track this order.  ",
            },
        )

        self.assertEqual(response.status_code, 201)
        message = ContactMessage.objects.get()
        self.assertEqual(message.reason, "Shipping & Tracking")
        self.assertEqual(message.first_name, "Nino")
        self.assertEqual(message.last_name, "Beridze")
        self.assertEqual(message.email, "nino@example.com")
        self.assertEqual(message.order_number, "ORD-123")
        self.assertEqual(message.message, "Please help me track this order.")
