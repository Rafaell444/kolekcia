"""WebSocket JWT extraction helpers (prefer subprotocol / cookie over query string)."""

from __future__ import annotations

from urllib.parse import parse_qs

ACCESS_TOKEN_PROTOCOL = "access_token"
COOKIE_TOKEN_KEYS = ("access_token", "access", "jwt")


def extract_ws_token(scope: dict) -> str | None:
    """
    Prefer Sec-WebSocket-Protocol: ``access_token, <jwt>``.
    Fall back to cookies, then ``?token=`` query string for compatibility.
    """
    protocols = list(scope.get("subprotocols") or [])
    if ACCESS_TOKEN_PROTOCOL in protocols:
        idx = protocols.index(ACCESS_TOKEN_PROTOCOL)
        if idx + 1 < len(protocols):
            candidate = (protocols[idx + 1] or "").strip()
            if candidate:
                return candidate

    cookies = scope.get("cookies") or {}
    for key in COOKIE_TOKEN_KEYS:
        value = cookies.get(key)
        if value:
            return value

    query = parse_qs(scope.get("query_string", b"").decode())
    token = (query.get("token") or [None])[0]
    return token or None


def preferred_ws_subprotocol(scope: dict) -> str | None:
    """Return the subprotocol to echo on accept when the client offered one."""
    protocols = list(scope.get("subprotocols") or [])
    if ACCESS_TOKEN_PROTOCOL in protocols:
        return ACCESS_TOKEN_PROTOCOL
    return None
