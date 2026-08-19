from __future__ import annotations

import hashlib
import hmac
import re
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from .models import ChatRestriction, RiskEvent


URL_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)


@dataclass(frozen=True)
class ModerationDecision:
    allowed: bool
    detail: str = ""
    retry_after: int | None = None


def _digest(value: str) -> str:
    if not value:
        return ""
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), value.encode("utf-8", errors="ignore"), hashlib.sha256
    ).hexdigest()


def request_signals(source) -> dict[str, str]:
    meta = getattr(source, "META", None)
    if meta is not None:
        ip = meta.get("HTTP_CF_CONNECTING_IP") or (meta.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
        ip = ip or meta.get("REMOTE_ADDR", "")
        user_agent = meta.get("HTTP_USER_AGENT", "")
        device = meta.get("HTTP_X_DEVICE_ID", "")
    else:
        headers = {
            key.decode("latin1").lower(): value.decode("latin1")
            for key, value in (source.get("headers") or [])
        }
        ip = headers.get("cf-connecting-ip") or headers.get("x-forwarded-for", "").split(",")[0].strip()
        client = source.get("client") or ("", 0)
        ip = ip or str(client[0] or "")
        user_agent = headers.get("user-agent", "")
        device = headers.get("x-device-id", "")
    return {
        "ip_hash": _digest(ip),
        "user_agent_hash": _digest(user_agent),
        "device_hash": _digest(device or user_agent),
    }


def log_risk_event(
    event_type: str,
    outcome: str,
    *,
    user=None,
    auction=None,
    vendor=None,
    source=None,
    reason: str = "",
    metadata: dict | None = None,
) -> RiskEvent:
    signals = request_signals(source) if source is not None else {}
    return RiskEvent.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        auction=auction,
        vendor=vendor or getattr(auction, "vendor", None),
        event_type=event_type,
        outcome=outcome,
        reason=reason[:300],
        metadata=metadata or {},
        **signals,
    )


def active_restriction(user, channel: str, *, vendor=None, auction=None):
    now = timezone.now()
    scope = Q(vendor__isnull=True, auction__isnull=True)
    if vendor is not None:
        scope |= Q(vendor=vendor, auction__isnull=True)
    if auction is not None:
        scope |= Q(auction=auction)
    return (
        ChatRestriction.objects.filter(user=user, channel__in=("all", channel))
        .filter(scope)
        .filter(Q(is_banned=True) | Q(requires_admin_review=True) | Q(muted_until__gt=now))
        .order_by("-auction_id", "-vendor_id", "-updated_at")
        .first()
    )


def _counter(key: str, timeout: int) -> int:
    if cache.add(key, 1, timeout=timeout):
        return 1
    try:
        return int(cache.incr(key))
    except ValueError:
        cache.set(key, 1, timeout=timeout)
        return 1


def _apply_automatic_mute(user, channel: str, *, vendor=None, auction=None, source=None) -> ChatRestriction:
    restriction = (
        ChatRestriction.objects.filter(user=user, channel=channel, vendor=vendor, auction=auction)
        .order_by("-updated_at")
        .first()
    )
    if not restriction:
        restriction = ChatRestriction(user=user, channel=channel, vendor=vendor, auction=auction)
    restriction.strike_count += 1
    restriction.reason = "Automatic spam-rate protection."
    if restriction.strike_count == 1:
        restriction.muted_until = timezone.now() + timedelta(seconds=30)
    elif restriction.strike_count == 2:
        restriction.muted_until = timezone.now() + timedelta(minutes=5)
    else:
        restriction.muted_until = None
        restriction.requires_admin_review = True
    restriction.save()
    log_risk_event(
        "chat_auto_mute",
        "rejected",
        user=user,
        auction=auction,
        vendor=vendor,
        source=source,
        reason=restriction.reason,
        metadata={"channel": channel, "strike": restriction.strike_count},
    )
    return restriction


def enforce_message(
    user,
    text: str,
    channel: str,
    *,
    vendor=None,
    auction=None,
    source=None,
    connection_id: str = "",
) -> ModerationDecision:
    if user.is_staff or hasattr(user, "vendor_profile"):
        return ModerationDecision(True)

    restriction = active_restriction(user, channel, vendor=vendor, auction=auction)
    if restriction:
        if restriction.is_banned:
            detail = "You are banned from this chat."
            retry_after = None
        elif restriction.requires_admin_review:
            detail = "Chat access is paused pending administrator review."
            retry_after = None
        else:
            retry_after = max(1, int((restriction.muted_until - timezone.now()).total_seconds()))
            detail = f"You are temporarily muted. Try again in {retry_after} seconds."
        log_risk_event(
            "chat_rejected", "rejected", user=user, auction=auction, vendor=vendor,
            source=source, reason=detail, metadata={"channel": channel},
        )
        return ModerationDecision(False, detail, retry_after)

    context_id = getattr(auction, "pk", None) or getattr(vendor, "pk", None) or "platform"
    signals = request_signals(source) if source is not None else {}
    account_count = _counter(f"chat-rate:user:{user.pk}:{channel}:{context_id}", 10)
    connection_count = _counter(f"chat-rate:conn:{_digest(connection_id)}:{channel}:{context_id}", 10) if connection_id else 0
    ip_hash = signals.get("ip_hash", "")
    ip_count = _counter(f"chat-rate:ip:{ip_hash}:{channel}:{context_id}", 10) if ip_hash else 0
    if account_count > 5 or connection_count > 5 or ip_count > 15:
        restriction = _apply_automatic_mute(
            user, channel, vendor=vendor, auction=auction, source=source
        )
        if restriction.requires_admin_review:
            return ModerationDecision(False, "Chat access is paused pending administrator review.")
        retry_after = max(1, int((restriction.muted_until - timezone.now()).total_seconds()))
        return ModerationDecision(False, f"Too many messages. Muted for {retry_after} seconds.", retry_after)

    normalized = " ".join(text.lower().split())
    text_hash = _digest(normalized)
    duplicate_key = f"chat-duplicate:{user.pk}:{channel}:{context_id}:{text_hash}"
    if normalized and not cache.add(duplicate_key, 1, timeout=30):
        detail = "Duplicate messages are not allowed."
        log_risk_event(
            "chat_duplicate", "rejected", user=user, auction=auction, vendor=vendor,
            source=source, reason=detail, metadata={"channel": channel},
        )
        return ModerationDecision(False, detail, 30)

    links = [link.rstrip(".,!?)").lower() for link in URL_RE.findall(text)]
    if len(links) > 2 or len(set(links)) < len(links):
        detail = "Repeated links are not allowed."
        log_risk_event(
            "chat_repeated_link", "rejected", user=user, auction=auction, vendor=vendor,
            source=source, reason=detail, metadata={"channel": channel, "link_count": len(links)},
        )
        return ModerationDecision(False, detail, 60)
    for link in links:
        if not cache.add(f"chat-link:{user.pk}:{channel}:{context_id}:{_digest(link)}", 1, timeout=120):
            detail = "That link was posted recently."
            log_risk_event(
                "chat_repeated_link", "rejected", user=user, auction=auction, vendor=vendor,
                source=source, reason=detail, metadata={"channel": channel},
            )
            return ModerationDecision(False, detail, 120)

    return ModerationDecision(True)
