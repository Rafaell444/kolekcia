import base64
import json
import os
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from django.conf import settings
from django.urls import reverse


KEEPZ_TEST_BASE_URL = "https://gateway.dev.keepz.me/ecommerce-service"
KEEPZ_REAL_BASE_URL = "https://gateway.keepz.me/ecommerce-service"


class KeepzConfigurationError(RuntimeError):
    pass


class KeepzGatewayError(RuntimeError):
    def __init__(self, message: str, payload: dict[str, Any] | None = None):
        super().__init__(message)
        self.payload = payload or {}


@dataclass(frozen=True)
class KeepzCreateOrderResult:
    payment_url: str
    provider_payload: dict[str, Any]
    request_payload: dict[str, Any]


def keepz_enabled() -> bool:
    return bool(getattr(settings, "KEEPZ_ENABLED", False))


def _base_url() -> str:
    return KEEPZ_REAL_BASE_URL if str(settings.KEEPZ_ENV).lower() == "real" else KEEPZ_TEST_BASE_URL


def _pem_public_key(key: str) -> bytes:
    key = (key or "").strip()
    if not key:
        raise KeepzConfigurationError("KEEPZ_PUBLIC_KEY is required.")
    if "BEGIN PUBLIC KEY" in key:
        return key.encode("utf-8")
    return f"-----BEGIN PUBLIC KEY-----\n{key}\n-----END PUBLIC KEY-----".encode("utf-8")


def _pem_private_key(key: str) -> bytes:
    key = (key or "").strip()
    if not key:
        raise KeepzConfigurationError("KEEPZ_PRIVATE_KEY is required.")
    if "BEGIN PRIVATE KEY" in key:
        return key.encode("utf-8")
    return f"-----BEGIN PRIVATE KEY-----\n{key}\n-----END PRIVATE KEY-----".encode("utf-8")


def _encrypt_using_public_key(data: str) -> str:
    public_key = serialization.load_pem_public_key(_pem_public_key(settings.KEEPZ_PUBLIC_KEY))
    encrypted = public_key.encrypt(
        data.encode("utf-8"),
        padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
    )
    return base64.b64encode(encrypted).decode("utf-8")


def _decrypt_using_private_key(encrypted_data: str) -> str:
    private_key = serialization.load_pem_private_key(_pem_private_key(settings.KEEPZ_PRIVATE_KEY), password=None)
    decrypted = private_key.decrypt(
        base64.b64decode(encrypted_data),
        padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
    )
    return decrypted.decode("utf-8")


def _pkcs7_pad(data: bytes) -> bytes:
    pad_len = 16 - (len(data) % 16)
    return data + bytes([pad_len]) * pad_len


def _pkcs7_unpad(data: bytes) -> bytes:
    if not data:
        return data
    pad_len = data[-1]
    if pad_len < 1 or pad_len > 16:
        raise KeepzGatewayError("Invalid Keepz AES padding.")
    return data[:-pad_len]


def encrypt_payload(payload: dict[str, Any]) -> dict[str, Any]:
    aes_key = os.urandom(32)
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    plain = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encrypted_data = encryptor.update(_pkcs7_pad(plain)) + encryptor.finalize()
    aes_properties = f"{base64.b64encode(aes_key).decode('utf-8')}.{base64.b64encode(iv).decode('utf-8')}"
    return {
        "identifier": settings.KEEPZ_IDENTIFIER,
        "encryptedData": base64.b64encode(encrypted_data).decode("utf-8"),
        "encryptedKeys": _encrypt_using_public_key(aes_properties),
        "aes": True,
    }


def decrypt_payload(response_payload: dict[str, Any]) -> dict[str, Any]:
    encrypted_keys = response_payload.get("encryptedKeys")
    encrypted_data = response_payload.get("encryptedData")
    if not encrypted_keys or not encrypted_data:
        raise KeepzGatewayError("Keepz response was not encrypted.", response_payload)
    aes_properties = _decrypt_using_private_key(str(encrypted_keys))
    key_b64, iv_b64 = aes_properties.split(".", 1)
    aes_key = base64.b64decode(key_b64)
    iv = base64.b64decode(iv_b64)
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(base64.b64decode(encrypted_data)) + decryptor.finalize()
    raw = _pkcs7_unpad(decrypted).decode("utf-8")
    return json.loads(raw)


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _absolute_url(path: str) -> str:
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}{path}"


def _frontend_url(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _apply_dynamic_urls(payload: dict[str, Any], success_path: str, fail_path: str) -> None:
    """Include per-order URLs only when Keepz enabled that permission."""
    if not getattr(settings, "KEEPZ_DYNAMIC_URLS", False):
        return
    payload.update(
        {
            "successRedirectUri": _frontend_url(success_path),
            "failRedirectUri": _frontend_url(fail_path),
            "callbackUri": _absolute_url(reverse("orders:keepz-callback")),
        }
    )


def _is_georgian_market(*, country: str = "", currency: str = "") -> bool:
    normalized_country = str(country or "").strip().upper()
    if normalized_country:
        return normalized_country in {"GE", "GEO", "GEORGIA", "საქართველო"}
    return str(currency or "").strip().upper() == "GEL"


def _market_receiver(*, country: str = "", currency: str = "") -> tuple[str, str, bool]:
    is_georgian = _is_georgian_market(country=country, currency=currency)
    if is_georgian:
        receiver_id = settings.KEEPZ_RECEIVER_ID
    else:
        receiver_id = str(getattr(settings, "KEEPZ_FOREIGN_RECEIVER_ID", "") or "").strip()
        if not receiver_id:
            raise KeepzConfigurationError("KEEPZ_FOREIGN_RECEIVER_ID is required for foreign-market payments.")
    return receiver_id, settings.KEEPZ_RECEIVER_TYPE or "BRANCH", is_georgian


def _apply_receiver_routing(
    payload: dict[str, Any],
    split_details: list[dict[str, Any]],
    *,
    country: str = "",
    currency: str = "",
) -> None:
    """Select the market merchant while preserving vendor payout allocations."""
    market_receiver_id, market_receiver_type, is_georgian = _market_receiver(
        country=country,
        currency=currency,
    )
    payload["receiverId"] = market_receiver_id
    payload["receiverType"] = market_receiver_type

    # The dedicated foreign-market receiver owns USD initiation permission.
    # Vendor receivers are GEL branches and must not replace it when split
    # payments are enabled, otherwise Keepz rejects the USD currency.
    if not is_georgian or not getattr(settings, "KEEPZ_SPLIT_ENABLED", False):
        return

    if is_georgian and len(split_details) == 1:
        receiver = split_details[0]
        payload["receiverId"] = receiver["receiverIdentifier"]
        payload["receiverType"] = receiver["receiverType"]
    elif len(split_details) > 1 or (
        split_details
        and split_details[0]["receiverIdentifier"] != market_receiver_id
    ):
        main_receiver = split_details[0]
        payload["receiverId"] = main_receiver["receiverIdentifier"]
        payload["receiverType"] = main_receiver["receiverType"]
        payload["splitDetails"] = split_details


def _split_details_for_order(order) -> list[dict[str, Any]]:
    """Build Keepz splitDetails from vendor merchant IDs.

    Vendor `merchant_id` is treated as the Keepz receiverIdentifier. Vendors
    without a merchant ID are routed through the main platform receiver.
    """
    receiver_type = settings.KEEPZ_VENDOR_RECEIVER_TYPE or "BRANCH"
    platform_id = settings.KEEPZ_RECEIVER_ID
    totals: dict[tuple[str, str], Decimal] = {}

    for item in order.items.select_related("vendor").all():
        receiver_id = item.vendor.merchant_id if item.vendor and item.vendor.merchant_id else platform_id
        key = (receiver_type if receiver_id != platform_id else settings.KEEPZ_RECEIVER_TYPE, receiver_id)
        line_total = _money((item.price * item.quantity) + item.processing_fee)
        totals[key] = totals.get(key, Decimal("0")) + line_total

    for shipment in order.shipments.select_related("vendor").all():
        receiver_id = shipment.vendor.merchant_id if shipment.vendor and shipment.vendor.merchant_id else platform_id
        key = (receiver_type if receiver_id != platform_id else settings.KEEPZ_RECEIVER_TYPE, receiver_id)
        totals[key] = totals.get(key, Decimal("0")) + _money(shipment.delivery_price)

    gross = sum(totals.values(), Decimal("0"))
    if gross <= 0:
        return []

    target_total = _money(order.total)
    scaled: list[tuple[tuple[str, str], Decimal]] = []
    allocated = Decimal("0")
    items = list(totals.items())
    for index, (key, amount) in enumerate(items):
        if index == len(items) - 1:
            split_amount = target_total - allocated
        else:
            split_amount = _money((amount / gross) * target_total)
            allocated += split_amount
        if split_amount > 0:
            scaled.append((key, split_amount))

    return [
        {
            "receiverType": receiver_type,
            "receiverIdentifier": receiver_id,
            "amount": float(amount),
        }
        for (receiver_type, receiver_id), amount in scaled
        if receiver_id
    ]


def validate_keepz_settings() -> None:
    required = {
        "KEEPZ_IDENTIFIER": settings.KEEPZ_IDENTIFIER,
        "KEEPZ_INTEGRATOR_ID": settings.KEEPZ_INTEGRATOR_ID,
        "KEEPZ_RECEIVER_ID": settings.KEEPZ_RECEIVER_ID,
        "KEEPZ_PUBLIC_KEY": settings.KEEPZ_PUBLIC_KEY,
        "KEEPZ_PRIVATE_KEY": settings.KEEPZ_PRIVATE_KEY,
    }
    missing = [key for key, value in required.items() if not str(value or "").strip()]
    if missing:
        raise KeepzConfigurationError(f"Missing Keepz settings: {', '.join(missing)}")


def create_keepz_order_for_checkout(payment_session, request=None) -> KeepzCreateOrderResult:
    validate_keepz_settings()
    order = payment_session.order
    success_path = f"/en/account/orders/{order.id}?payment=success"
    fail_path = "/en"
    payload: dict[str, Any] = {
        "amount": float(_money(payment_session.amount)),
        "integratorId": settings.KEEPZ_INTEGRATOR_ID,
        "integratorOrderId": str(payment_session.integrator_order_id),
        "currency": payment_session.currency,
        "language": "KA" if payment_session.currency == "GEL" else "EN",
        "orderProperties": {
            "INTEGRATOR_PRODUCT_NAME": {
                "value": f"Koleqcia order {order.order_number}",
                "isEditable": False,
            },
            "DESCRIPTION": {
                "value": f"Koleqcia order {order.order_number}",
                "isEditable": False,
            },
        },
    }
    _apply_dynamic_urls(payload, success_path, fail_path)
    if settings.KEEPZ_DIRECT_LINK_PROVIDER:
        payload["directLinkProvider"] = settings.KEEPZ_DIRECT_LINK_PROVIDER
    if settings.KEEPZ_COMMISSION_TYPE:
        payload["commissionType"] = settings.KEEPZ_COMMISSION_TYPE
    split_details = _split_details_for_order(order)
    _apply_receiver_routing(
        payload,
        split_details,
        country=order.shipping_country,
        currency=payment_session.currency,
    )

    encrypted = encrypt_payload(payload)
    response = requests.post(f"{_base_url()}/api/integrator/order", json=encrypted, timeout=30)
    response_payload = response.json()
    if not response.ok:
        raise KeepzGatewayError("Keepz order creation failed.", response_payload)
    decrypted = decrypt_payload(response_payload)
    payment_url = decrypted.get("urlForQR")
    if not payment_url:
        raise KeepzGatewayError("Keepz did not return a payment URL.", decrypted)
    return KeepzCreateOrderResult(payment_url=payment_url, provider_payload=decrypted, request_payload=payload)


def create_keepz_order_for_points_shipping(payment_session) -> KeepzCreateOrderResult:
    validate_keepz_settings()
    from apps.gamification.models import PointsMarketShippingPaymentSession

    shipping_session = PointsMarketShippingPaymentSession.objects.select_related("market_item__vendor").get(
        token=payment_session.related_id
    )
    vendor = shipping_session.market_item.vendor if shipping_session.market_item_id else None
    split_details = []
    if vendor and vendor.merchant_id:
        split_details = [{
            "receiverType": settings.KEEPZ_VENDOR_RECEIVER_TYPE or "BRANCH",
            "receiverIdentifier": vendor.merchant_id,
            "amount": float(_money(payment_session.amount)),
        }]

    payload: dict[str, Any] = {
        "amount": float(_money(payment_session.amount)),
        "integratorId": settings.KEEPZ_INTEGRATOR_ID,
        "integratorOrderId": str(payment_session.integrator_order_id),
        "currency": payment_session.currency,
        "language": "KA" if payment_session.currency == "GEL" else "EN",
        "orderProperties": {
            "INTEGRATOR_PRODUCT_NAME": {
                "value": f"Points reward shipping: {shipping_session.item_name}",
                "isEditable": False,
            },
            "DESCRIPTION": {
                "value": f"Shipping fee for points reward {shipping_session.item_name}",
                "isEditable": False,
            },
        },
    }
    _apply_dynamic_urls(
        payload,
        f"/en/account/awards/shipping-payment?session={shipping_session.token}&payment=success",
        f"/en/account/awards/shipping-payment?session={shipping_session.token}&payment=failed",
    )
    if settings.KEEPZ_DIRECT_LINK_PROVIDER:
        payload["directLinkProvider"] = settings.KEEPZ_DIRECT_LINK_PROVIDER
    if settings.KEEPZ_COMMISSION_TYPE:
        payload["commissionType"] = settings.KEEPZ_COMMISSION_TYPE
    _apply_receiver_routing(
        payload,
        split_details,
        country=shipping_session.shipping_country,
        currency=payment_session.currency,
    )

    encrypted = encrypt_payload(payload)
    response = requests.post(f"{_base_url()}/api/integrator/order", json=encrypted, timeout=30)
    response_payload = response.json()
    if not response.ok:
        raise KeepzGatewayError("Keepz points shipping order creation failed.", response_payload)
    decrypted = decrypt_payload(response_payload)
    payment_url = decrypted.get("urlForQR")
    if not payment_url:
        raise KeepzGatewayError("Keepz did not return a points shipping payment URL.", decrypted)
    return KeepzCreateOrderResult(payment_url=payment_url, provider_payload=decrypted, request_payload=payload)


def create_keepz_order_for_custom_order(payment_session) -> KeepzCreateOrderResult:
    validate_keepz_settings()
    from apps.orders.models import CustomOrder

    custom_order = CustomOrder.objects.select_related("vendor").get(pk=payment_session.related_id)
    split_details = []
    if custom_order.vendor and custom_order.vendor.merchant_id:
        split_details = [{
            "receiverType": settings.KEEPZ_VENDOR_RECEIVER_TYPE or "BRANCH",
            "receiverIdentifier": custom_order.vendor.merchant_id,
            "amount": float(_money(payment_session.amount)),
        }]
    payload: dict[str, Any] = {
        "amount": float(_money(payment_session.amount)),
        "integratorId": settings.KEEPZ_INTEGRATOR_ID,
        "integratorOrderId": str(payment_session.integrator_order_id),
        "currency": payment_session.currency,
        "language": "KA" if payment_session.currency == "GEL" else "EN",
        "orderProperties": {
            "INTEGRATOR_PRODUCT_NAME": {
                "value": f"Koleqcia custom order {custom_order.payment_ref}",
                "isEditable": False,
            },
            "DESCRIPTION": {
                "value": f"Custom order: {custom_order.product_type or custom_order.name}",
                "isEditable": False,
            },
        },
    }
    _apply_dynamic_urls(
        payload,
        f"/en/account?tab=orders&custom={custom_order.id}&payment=success",
        f"/en/account?tab=orders&custom={custom_order.id}&payment=failed",
    )
    if settings.KEEPZ_DIRECT_LINK_PROVIDER:
        payload["directLinkProvider"] = settings.KEEPZ_DIRECT_LINK_PROVIDER
    if settings.KEEPZ_COMMISSION_TYPE:
        payload["commissionType"] = settings.KEEPZ_COMMISSION_TYPE
    _apply_receiver_routing(payload, split_details, currency=payment_session.currency)
    encrypted = encrypt_payload(payload)
    response = requests.post(f"{_base_url()}/api/integrator/order", json=encrypted, timeout=30)
    response_payload = response.json()
    if not response.ok:
        raise KeepzGatewayError("Keepz custom order payment creation failed.", response_payload)
    decrypted = decrypt_payload(response_payload)
    payment_url = decrypted.get("urlForQR")
    if not payment_url:
        raise KeepzGatewayError("Keepz did not return a custom order payment URL.", decrypted)
    return KeepzCreateOrderResult(payment_url=payment_url, provider_payload=decrypted, request_payload=payload)


def create_keepz_order_for_auction(payment_session) -> KeepzCreateOrderResult:
    validate_keepz_settings()
    from apps.auctions.models import Auction

    auction = Auction.objects.select_related("vendor").get(pk=payment_session.related_id)
    split_details = []
    if auction.vendor and auction.vendor.merchant_id:
        split_details = [{
            "receiverType": settings.KEEPZ_VENDOR_RECEIVER_TYPE or "BRANCH",
            "receiverIdentifier": auction.vendor.merchant_id,
            "amount": float(_money(payment_session.amount)),
        }]
    payload: dict[str, Any] = {
        "amount": float(_money(payment_session.amount)),
        "integratorId": settings.KEEPZ_INTEGRATOR_ID,
        "integratorOrderId": str(payment_session.integrator_order_id),
        "currency": payment_session.currency,
        "language": "KA" if payment_session.currency == "GEL" else "EN",
        "orderProperties": {
            "INTEGRATOR_PRODUCT_NAME": {
                "value": f"Koleqcia auction {auction.title}",
                "isEditable": False,
            },
            "DESCRIPTION": {
                "value": f"Auction winner payment: {auction.title}",
                "isEditable": False,
            },
        },
    }
    _apply_dynamic_urls(
        payload,
        f"/en/auctions/{auction.slug or auction.pk}?payment=success",
        f"/en/auctions/{auction.slug or auction.pk}?payment=failed",
    )
    if settings.KEEPZ_DIRECT_LINK_PROVIDER:
        payload["directLinkProvider"] = settings.KEEPZ_DIRECT_LINK_PROVIDER
    if settings.KEEPZ_COMMISSION_TYPE:
        payload["commissionType"] = settings.KEEPZ_COMMISSION_TYPE
    _apply_receiver_routing(payload, split_details, currency=payment_session.currency)
    encrypted = encrypt_payload(payload)
    response = requests.post(f"{_base_url()}/api/integrator/order", json=encrypted, timeout=30)
    response_payload = response.json()
    if not response.ok:
        raise KeepzGatewayError("Keepz auction payment creation failed.", response_payload)
    decrypted = decrypt_payload(response_payload)
    payment_url = decrypted.get("urlForQR")
    if not payment_url:
        raise KeepzGatewayError("Keepz did not return an auction payment URL.", decrypted)
    return KeepzCreateOrderResult(payment_url=payment_url, provider_payload=decrypted, request_payload=payload)


def request_keepz_refund(payment_session, amount: Decimal | None = None) -> dict[str, Any]:
    validate_keepz_settings()
    refund_amount = _money(amount or payment_session.amount)
    payload = {
        "integratorId": settings.KEEPZ_INTEGRATOR_ID,
        "integratorOrderId": str(payment_session.integrator_order_id),
        "amount": float(refund_amount),
        "refundInitiator": "INTEGRATOR",
    }
    encrypted = encrypt_payload(payload)
    response = requests.post(f"{_base_url()}/api/integrator/order/refund/v2", json=encrypted, timeout=30)
    response_payload = response.json()
    if not response.ok:
        raise KeepzGatewayError("Keepz refund request failed.", response_payload)
    return decrypt_payload(response_payload)


def get_keepz_order_status(integrator_order_id: str) -> dict[str, Any]:
    validate_keepz_settings()
    payload = {
        "integratorId": settings.KEEPZ_INTEGRATOR_ID,
        "integratorOrderId": str(integrator_order_id),
    }
    encrypted = encrypt_payload(payload)
    response = requests.get(f"{_base_url()}/api/integrator/order/status", params=encrypted, timeout=30)
    response_payload = response.json()
    if not response.ok:
        raise KeepzGatewayError("Keepz status lookup failed.", response_payload)
    return decrypt_payload(response_payload)
