from django.test import SimpleTestCase, override_settings

from apps.orders.keepz import (
    KeepzConfigurationError,
    _apply_receiver_routing,
)


GEORGIAN_RECEIVER = "georgian-market-receiver"
FOREIGN_RECEIVER = "foreign-market-receiver"
MANGAMOON_RECEIVER = "mangamoon-receiver"
SCULPI_RECEIVER = "sculpi-receiver"


@override_settings(
    KEEPZ_RECEIVER_ID=GEORGIAN_RECEIVER,
    KEEPZ_FOREIGN_RECEIVER_ID=FOREIGN_RECEIVER,
    KEEPZ_RECEIVER_TYPE="BRANCH",
    KEEPZ_SPLIT_ENABLED=True,
)
class KeepzReceiverRoutingTests(SimpleTestCase):
    def split(self, receiver_id: str, amount: float) -> dict:
        return {
            "receiverType": "BRANCH",
            "receiverIdentifier": receiver_id,
            "amount": amount,
        }

    def test_georgian_single_vendor_uses_direct_vendor_payment(self):
        payload = {}

        _apply_receiver_routing(
            payload,
            [self.split(MANGAMOON_RECEIVER, 100.0)],
            country="GE",
            currency="GEL",
        )

        self.assertEqual(payload["receiverId"], MANGAMOON_RECEIVER)
        self.assertNotIn("splitDetails", payload)

    def test_georgian_mixed_vendor_payment_is_split_with_main_receiver_in_details(self):
        payload = {}
        split_details = [
            self.split(MANGAMOON_RECEIVER, 60.0),
            self.split(SCULPI_RECEIVER, 40.0),
        ]

        _apply_receiver_routing(payload, split_details, country="GE", currency="GEL")

        self.assertEqual(payload["receiverId"], MANGAMOON_RECEIVER)
        self.assertEqual(payload["splitDetails"], split_details)
        self.assertTrue(any(
            item["receiverIdentifier"] == payload["receiverId"]
            for item in payload["splitDetails"]
        ))

    def test_foreign_single_vendor_uses_foreign_market_receiver_when_split_enabled(self):
        payload = {}
        split_details = [self.split(SCULPI_RECEIVER, 25.0)]

        _apply_receiver_routing(payload, split_details, country="US", currency="USD")

        self.assertEqual(payload["receiverId"], FOREIGN_RECEIVER)
        self.assertNotIn("splitDetails", payload)

    def test_foreign_mixed_vendor_payment_uses_foreign_market_receiver(self):
        payload = {}
        split_details = [
            self.split(MANGAMOON_RECEIVER, 55.0),
            self.split(SCULPI_RECEIVER, 45.0),
        ]

        _apply_receiver_routing(payload, split_details, country="DE", currency="USD")

        self.assertEqual(payload["receiverId"], FOREIGN_RECEIVER)
        self.assertNotIn("splitDetails", payload)

    def test_shipping_country_takes_precedence_over_currency(self):
        payload = {}

        _apply_receiver_routing(payload, [], country="US", currency="GEL")

        self.assertEqual(payload["receiverId"], FOREIGN_RECEIVER)

    @override_settings(KEEPZ_FOREIGN_RECEIVER_ID="")
    def test_foreign_payment_fails_closed_without_receiver_configuration(self):
        with self.assertRaises(KeepzConfigurationError):
            _apply_receiver_routing({}, [], country="US", currency="USD")


@override_settings(
    KEEPZ_RECEIVER_ID=GEORGIAN_RECEIVER,
    KEEPZ_FOREIGN_RECEIVER_ID=FOREIGN_RECEIVER,
    KEEPZ_RECEIVER_TYPE="BRANCH",
    KEEPZ_SPLIT_ENABLED=False,
)
class KeepzNoSplitReceiverRoutingTests(SimpleTestCase):
    def split(self, receiver_id: str, amount: float) -> dict:
        return {
            "receiverType": "BRANCH",
            "receiverIdentifier": receiver_id,
            "amount": amount,
        }

    def test_georgian_mixed_vendor_payment_uses_market_receiver_without_split(self):
        payload = {}
        split_details = [
            self.split(MANGAMOON_RECEIVER, 60.0),
            self.split(SCULPI_RECEIVER, 40.0),
        ]

        _apply_receiver_routing(payload, split_details, country="GE", currency="GEL")

        self.assertEqual(payload["receiverId"], GEORGIAN_RECEIVER)
        self.assertNotIn("splitDetails", payload)

    def test_foreign_vendor_payment_uses_foreign_receiver_without_split(self):
        payload = {}

        _apply_receiver_routing(payload, [self.split(SCULPI_RECEIVER, 25.0)], country="US", currency="USD")

        self.assertEqual(payload["receiverId"], FOREIGN_RECEIVER)
        self.assertNotIn("splitDetails", payload)
