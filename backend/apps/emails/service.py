import logging
import re

from django.conf import settings
from django.core.mail import EmailMessage

from .models import EmailTemplate, EmailLog

logger = logging.getLogger(__name__)

_VAR_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")

# Maps each event to a Workspace From alias category.
_EVENT_FROM_CATEGORY = {
    "password_reset": "accounts",
    "order_confirmed": "orders",
    "order_shipped": "orders",
    "review_request": "orders",
    "custom_order_shipped": "orders",
    "auction_new": "auctions",
    "auction_won": "auctions",
}

_FROM_DISPLAY_NAMES = {
    "accounts": "Koleqcia Accounts",
    "orders": "Koleqcia Orders",
    "auctions": "Koleqcia Auctions",
}


def from_email_address_for_event(event_key: str) -> str:
    """Bare address only (no display name)."""
    category = _EVENT_FROM_CATEGORY.get(event_key)
    if category == "accounts":
        return settings.EMAIL_FROM_ACCOUNTS or settings.DEFAULT_FROM_EMAIL
    if category == "orders":
        return settings.EMAIL_FROM_ORDERS or settings.DEFAULT_FROM_EMAIL
    if category == "auctions":
        return settings.EMAIL_FROM_AUCTIONS or settings.DEFAULT_FROM_EMAIL
    return settings.DEFAULT_FROM_EMAIL


def from_email_for_event(event_key: str) -> str:
    """Branded From header: 'Display Name <alias@domain>'."""
    address = from_email_address_for_event(event_key)
    category = _EVENT_FROM_CATEGORY.get(event_key)
    display = _FROM_DISPLAY_NAMES.get(category or "", "")
    if display:
        return f"{display} <{address}>"
    return address


def _render(template_str: str, context: dict) -> str:
    """Replace {{variable}} placeholders with values from context."""
    def _replace(match):
        key = match.group(1)
        return str(context.get(key, match.group(0)))
    return _VAR_RE.sub(_replace, template_str)


def get_template(event_key: str, vendor=None) -> EmailTemplate | None:
    """
    Resolve the best-matching active template:
      1. Vendor-specific template for this event
      2. Platform-wide (vendor=NULL) template for this event
    """
    if vendor is not None:
        tpl = EmailTemplate.objects.filter(
            event_key=event_key, vendor=vendor, is_active=True
        ).first()
        if tpl:
            return tpl

    return EmailTemplate.objects.filter(
        event_key=event_key, vendor__isnull=True, is_active=True
    ).first()


def send_template_email(
    event_key: str,
    recipient_email: str,
    context: dict,
    vendor=None,
) -> bool:
    """
    Send a transactional email by event key.

    1. Resolves the template (vendor-specific → platform fallback)
    2. Renders {{variable}} placeholders with context values
    3. Sends HTML email via Django's EmailMessage
    4. Logs the result to EmailLog

    Returns True on success, False on failure.
    """
    template = get_template(event_key, vendor=vendor)
    if template is None:
        logger.warning("No email template found for event_key=%s vendor=%s", event_key, vendor)
        return False

    subject = _render(template.subject, context)
    html_body = _render(template.html_body, context)
    from_email = from_email_for_event(event_key)
    from_address = from_email_address_for_event(event_key)

    msg = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=from_email,
        to=[recipient_email],
        reply_to=[from_address],
    )
    msg.content_subtype = "html"

    try:
        msg.send(fail_silently=False)
        EmailLog.objects.create(
            template=template,
            recipient_email=recipient_email,
            subject=subject,
            event_key=event_key,
            status=EmailLog.STATUS_SENT,
        )
        logger.info("Email sent: event=%s to=%s from=%s", event_key, recipient_email, from_email)
        return True
    except Exception as exc:
        EmailLog.objects.create(
            template=template,
            recipient_email=recipient_email,
            subject=subject,
            event_key=event_key,
            status=EmailLog.STATUS_FAILED,
            error_message=str(exc),
        )
        logger.error("Email failed: event=%s to=%s error=%s", event_key, recipient_email, exc)
        return False


def send_to_auction_subscribers(auction) -> int:
    """
    Send the 'auction_new' email to all active auction subscribers.
    Returns the count of successfully sent emails.
    """
    from apps.auctions.models import AuctionSubscriber

    subscribers = AuctionSubscriber.objects.filter(is_active=True).values_list("email", flat=True)
    context = {
        "auction_title": auction.title,
        "starting_bid": str(auction.starting_bid),
        "starts_at": auction.starts_at.strftime("%B %d, %Y at %H:%M UTC"),
        "image_url": auction.image_url or "",
        "auction_url": f"{settings.FRONTEND_URL}/auctions/{auction.slug}",
    }

    sent = 0
    for email in subscribers:
        if send_template_email("auction_new", email, context, vendor=auction.vendor):
            sent += 1
    return sent
