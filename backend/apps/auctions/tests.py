from datetime import timedelta
from decimal import Decimal

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.orders.models import ProcessingOption
from apps.products.models import Product, SizeVariant
from apps.users.models import User
from apps.vendors.models import Vendor

from kolekcia.asgi import application

from .models import Auction, AuctionBid, AuctionBidderBan, AuctionChatMessage
from .serializers import AuctionSerializer
from .services import FX_CACHE_KEY, release_auction_inventory, reserve_auction_inventory


class AuctionSecurityTests(TestCase):
    def setUp(self):
        cache.set(FX_CACHE_KEY, "2.700000", timeout=60)
        self.staff = User.objects.create_user(
            email="admin@example.com", password="test-password", is_staff=True
        )
        vendor_user = User.objects.create_user(email="vendor@example.com", password="test-password")
        self.vendor = Vendor.objects.create(user=vendor_user, name="Studio", slug="studio")
        self.product = Product.objects.create(
            title="Ready figure", base_price="100.00", vendor=self.vendor
        )
        processing = ProcessingOption.objects.create(
            vendor=self.vendor, slug="made-to-order", label="Made to order"
        )
        self.product.processing_options.add(processing)
        self.variant = SizeVariant.objects.create(
            product=self.product,
            label="Standard",
            price_usd="100.00",
            stock=1,
            is_ready_to_ship=True,
        )

    def tearDown(self):
        cache.delete(FX_CACHE_KEY)

    def make_auction(self, **overrides):
        data = {
            "product": self.product,
            "vendor": self.vendor,
            "title": self.product.title,
            "starting_bid": "10.00",
            "starts_at": timezone.now() - timedelta(days=2),
            "ends_at": timezone.now() - timedelta(days=1),
            "status": Auction.STATUS_ACTIVE,
        }
        data.update(overrides)
        return Auction.objects.create(**data)

    def test_final_ready_unit_becomes_made_to_order_and_can_be_restored(self):
        auction = self.make_auction(status=Auction.STATUS_INACTIVE)

        reserve_auction_inventory(auction, self.variant.id)
        self.variant.refresh_from_db()
        auction.refresh_from_db()
        self.assertIsNone(self.variant.stock)
        self.assertFalse(self.variant.is_ready_to_ship)
        self.assertTrue(auction.inventory_reserved)

        release_auction_inventory(auction)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 1)
        self.assertTrue(self.variant.is_ready_to_ship)

    def test_reserving_one_of_multiple_units_decrements_stock(self):
        self.variant.stock = 3
        self.variant.save(update_fields=("stock",))
        auction = self.make_auction(status=Auction.STATUS_INACTIVE)

        reserve_auction_inventory(auction, self.variant.id)
        self.variant.refresh_from_db()

        self.assertEqual(self.variant.stock, 2)
        self.assertTrue(self.variant.is_ready_to_ship)

    def test_expired_auction_without_bids_restores_reserved_multi_stock_once(self):
        self.variant.stock = 3
        self.variant.save(update_fields=("stock",))
        auction = self.make_auction()
        reserve_auction_inventory(auction, self.variant.id)

        self.assertTrue(auction.finalize_if_ended())
        auction.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertFalse(auction.inventory_reserved)
        self.assertEqual(self.variant.stock, 3)
        self.assertTrue(self.variant.is_ready_to_ship)

        self.assertFalse(auction.finalize_if_ended())
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 3)

    def test_expired_auction_without_bids_restores_final_ready_unit(self):
        auction = self.make_auction()
        reserve_auction_inventory(auction, self.variant.id)

        self.assertTrue(auction.finalize_if_ended())
        auction.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertFalse(auction.inventory_reserved)
        self.assertEqual(self.variant.stock, 1)
        self.assertTrue(self.variant.is_ready_to_ship)

    def test_expired_auction_with_only_disqualified_bids_keeps_inventory_reserved(self):
        self.variant.stock = 3
        self.variant.save(update_fields=("stock",))
        auction = self.make_auction()
        reserve_auction_inventory(auction, self.variant.id)
        bidder = User.objects.create_user(email="disqualified@example.com", password="test-password")
        AuctionBid.objects.create(
            auction=auction,
            user=bidder,
            amount="20.00",
            is_disqualified=True,
        )

        self.assertFalse(auction.finalize_if_ended())
        auction.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertTrue(auction.inventory_reserved)
        self.assertEqual(self.variant.stock, 2)

    def test_public_bid_response_does_not_expose_email_or_user_id(self):
        bidder = User.objects.create_user(email="private@example.com", password="test-password")
        auction = self.make_auction()
        AuctionBid.objects.create(auction=auction, user=bidder, amount="20.00")

        public_bid = AuctionSerializer(auction).data["recent_bids"][0]
        private_bid = AuctionSerializer(
            auction,
            context={"include_all_bids": True, "include_bidder_private_data": True},
        ).data["all_bids"][0]

        self.assertNotIn("user_email", public_bid)
        self.assertNotIn("user_id", public_bid)
        self.assertNotIn("submitted_amount", public_bid)
        self.assertNotIn("submitted_currency", public_bid)
        self.assertNotIn("fx_rate_used", public_bid)
        self.assertEqual(AuctionSerializer(auction).data["top_bidder"], "private")
        self.assertEqual(private_bid["user_email"], "private@example.com")

    def test_same_auction_accepts_usd_and_gel_bids_using_one_canonical_total(self):
        usd_bidder = User.objects.create_user(email="usd@example.com", password="test-password")
        gel_bidder = User.objects.create_user(email="gel@example.com", password="test-password")
        auction = self.make_auction(
            starts_at=timezone.now() - timedelta(hours=1),
            ends_at=timezone.now() + timedelta(hours=1),
            shipping_price_gel="15.00",
            shipping_price_usd="6.00",
        )
        client = APIClient()

        client.force_authenticate(usd_bidder)
        usd_response = client.post(
            f"/api/auctions/{auction.slug}/bid/",
            {"amount": "12.00", "currency": "USD"},
            format="json",
        )
        self.assertEqual(usd_response.status_code, 201, usd_response.data)

        client.force_authenticate(gel_bidder)
        gel_response = client.post(
            f"/api/auctions/{auction.slug}/bid/",
            {"amount": "35.10", "currency": "GEL"},
            format="json",
        )
        self.assertEqual(gel_response.status_code, 201, gel_response.data)
        self.assertEqual(gel_response.data["current_bid_usd"], "13.00")
        self.assertEqual(gel_response.data["current_bid_gel"], "35.10")
        self.assertEqual(gel_response.data["shipping_price_gel"], "15.00")
        self.assertEqual(gel_response.data["shipping_price_usd"], "6.00")

        winning_bid = AuctionBid.objects.get(auction=auction, user=gel_bidder)
        self.assertEqual(winning_bid.amount, Decimal("13.00"))
        self.assertEqual(winning_bid.submitted_amount, Decimal("35.10"))
        self.assertEqual(winning_bid.submitted_currency, "GEL")
        self.assertEqual(winning_bid.fx_rate_used, Decimal("2.700000"))

        public_bid = gel_response.data["recent_bids"][0]
        self.assertEqual(public_bid["amount_usd"], "13.00")
        self.assertEqual(public_bid["amount_gel"], "35.10")
        self.assertNotIn("submitted_currency", public_bid)

    def test_admin_can_disqualify_and_promote_previous_bidder(self):
        first = User.objects.create_user(email="first@example.com", password="test-password")
        second = User.objects.create_user(email="second@example.com", password="test-password")
        auction = self.make_auction()
        previous_bid = AuctionBid.objects.create(auction=auction, user=first, amount="20.00")
        winning_bid = AuctionBid.objects.create(auction=auction, user=second, amount="30.00")
        auction.finalize_if_ended()
        client = APIClient()
        client.force_authenticate(self.staff)

        response = client.post(
            f"/api/auctions/vendor/{auction.id}/bids/{winning_bid.id}/disqualify/",
            {"reason": "Payment deadline missed."},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(AuctionBidderBan.objects.filter(user=second, vendor=self.vendor).exists())
        winning_bid.refresh_from_db()
        self.assertTrue(winning_bid.is_disqualified)

        response = client.post(
            f"/api/auctions/vendor/{auction.id}/bids/{previous_bid.id}/promote/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        auction.refresh_from_db()
        self.assertEqual(auction.winner, first)
        self.assertEqual(str(auction.winning_amount), "20.00")
        self.assertTrue(auction.is_replacement_winner)


class AuctionWebSocketTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.user = User.objects.create_user(email="chat@example.com", password="test-password", name="Chat User")
        self.auction = Auction.objects.create(
            title="Live chat auction",
            starting_bid="10.00",
            starts_at=timezone.now() - timedelta(minutes=5),
            ends_at=timezone.now() + timedelta(minutes=5),
            status=Auction.STATUS_ACTIVE,
        )

    async def _send_authenticated_message(self, token):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/auctions/{self.auction.id}/",
            subprotocols=["access_token", token],
        )
        connected, subprotocol = await communicator.connect()
        if not connected:
            return connected, subprotocol, None
        await communicator.send_json_to({"text": "QA websocket message"})
        response = await communicator.receive_json_from(timeout=2)
        await communicator.disconnect()
        return connected, subprotocol, response

    async def _connect_without_token(self):
        communicator = WebsocketCommunicator(application, f"/ws/auctions/{self.auction.id}/")
        connected, _ = await communicator.connect()
        if connected:
            await communicator.disconnect()
        return connected

    def test_authenticated_live_chat_connects_persists_and_broadcasts(self):
        token = str(RefreshToken.for_user(self.user).access_token)

        connected, subprotocol, response = async_to_sync(self._send_authenticated_message)(token)

        self.assertTrue(connected)
        self.assertEqual(subprotocol, "access_token")
        self.assertEqual(response["user_name"], "Chat User")
        self.assertEqual(response["text"], "QA websocket message")
        self.assertTrue(AuctionChatMessage.objects.filter(
            auction=self.auction,
            user=self.user,
            text="QA websocket message",
        ).exists())

    def test_unauthenticated_websocket_is_rejected(self):
        self.assertFalse(async_to_sync(self._connect_without_token)())
