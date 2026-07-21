"""
Brand email templates for Koleqcia.

Table-based, inline-CSS HTML for maximum client compatibility.
Colors: CTA #e63946 · Gold #b86e00 · Ink #111113 · Muted #636366
"""

from __future__ import annotations

CTA = "#e63946"
GOLD = "#b86e00"
INK = "#111113"
MUTED = "#636366"
BORDER = "#e5e5e7"
BG = "#f4f4f5"
WHITE = "#ffffff"


def _shell(*, preheader: str, eyebrow: str, title: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    # Build CTA without f-string on placeholder URLs
    cta_block = ""
    if cta_label and cta_url:
        cta_block = (
            '<tr><td align="center" style="padding:8px 0 28px;">'
            '<a href="' + cta_url + '" target="_blank" '
            'style="display:inline-block;background:' + CTA + ";color:" + WHITE + ";"
            "font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;"
            "letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;"
            'padding:16px 36px;border-radius:2px;">'
            + cta_label
            + "</a></td></tr>"
        )

    return (
        "<!DOCTYPE html>\n<html lang=\"en\"><head>"
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light"><title>Koleqcia</title></head>'
        '<body style="margin:0;padding:0;background:' + BG + ';">'
        '<div style="display:none;max-height:0;overflow:hidden;">' + preheader + "&nbsp;</div>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + BG + ';">'
        '<tr><td align="center" style="padding:32px 16px;">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" '
        'style="width:100%;max-width:600px;background:' + WHITE + ";border:1px solid " + BORDER + ';">'
        # Brand bar
        '<tr><td style="background:' + INK + ';padding:28px 40px 24px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        '<td style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;'
        "letter-spacing:0.22em;color:" + WHITE + ';text-transform:uppercase;">KOLEQCIA</td>'
        '<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;'
        "letter-spacing:0.14em;text-transform:uppercase;color:" + GOLD + ';">Made in Georgia</td>'
        "</tr></table>"
        '<div style="height:3px;width:48px;background:' + CTA + ';margin-top:18px;"></div>'
        "</td></tr>"
        # Hero
        '<tr><td style="padding:40px 40px 8px;">'
        '<p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;'
        "letter-spacing:0.18em;text-transform:uppercase;color:" + GOLD + ';">' + eyebrow + "</p>"
        '<h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:1.2;'
        "font-weight:800;color:" + INK + ';">' + title + "</h1>"
        "</td></tr>"
        # Body
        '<tr><td style="padding:20px 40px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;'
        "line-height:1.65;color:" + MUTED + ';">' + body_html + "</td></tr>"
        + cta_block
        + '<tr><td style="padding:0 40px;"><div style="height:1px;background:' + BORDER + ';"></div></td></tr>'
        # Footer
        '<tr><td style="padding:28px 40px 36px;font-family:Arial,Helvetica,sans-serif;font-size:12px;'
        'line-height:1.6;color:#aeaeb2;">'
        '<p style="margin:0 0 8px;color:' + INK + ';font-weight:700;letter-spacing:0.12em;'
        'text-transform:uppercase;font-size:11px;">Koleqcia</p>'
        "<p style=\"margin:0;\">Artist-made metal posters, figures &amp; custom prints.<br>"
        "Questions? Reply to this email or write us at support.</p>"
        '<p style="margin:16px 0 0;">&copy; Koleqcia · Proudly made in Georgia</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )


def _info_card(rows: list[tuple[str, str]]) -> str:
    cells = []
    for label, value in rows:
        cells.append(
            "<tr>"
            '<td style="padding:10px 0;border-bottom:1px solid ' + BORDER + ";"
            "font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;"
            'text-transform:uppercase;color:#aeaeb2;width:40%;">' + label + "</td>"
            '<td style="padding:10px 0;border-bottom:1px solid ' + BORDER + ";"
            "font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;"
            "color:" + INK + ';text-align:right;">' + value + "</td>"
            "</tr>"
        )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:24px 0;background:' + BG + ";border:1px solid " + BORDER + ';">'
        '<tr><td style="padding:8px 20px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        + "".join(cells)
        + "</table></td></tr></table>"
    )


def order_confirmed_html() -> str:
    body = (
        '<p style="margin:0 0 12px;color:' + INK + ';font-size:16px;font-weight:600;">Your order is locked in.</p>'
        "<p style=\"margin:0;\">We're preparing your metal art with care. You'll get another email the moment it ships.</p>"
        + _info_card([
            ("Order", "#{{order_number}}"),
            ("Total", "{{total}} {{currency}}"),
        ])
        + '<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;'
        'color:#aeaeb2;font-weight:700;">Items</p>'
        '<div style="padding:16px 18px;background:' + BG + ";border:1px solid " + BORDER + ";"
        "color:" + INK + ';font-size:14px;line-height:1.7;white-space:pre-wrap;">{{items}}</div>'
    )
    return _shell(
        preheader="Order {{order_number}} is confirmed — thank you for shopping Koleqcia.",
        eyebrow="Order confirmed",
        title="Thanks, {{customer_name}}.",
        body_html=body,
        cta_label="View your orders",
        cta_url="https://koleqcia.com/account/orders",
    )


def order_shipped_html() -> str:
    body = (
        '<p style="margin:0 0 12px;color:' + INK + ';font-size:16px;font-weight:600;">Hi {{customer_name}},</p>'
        '<p style="margin:0;">Great news — order <strong style="color:' + INK + ';">#{{order_number}}</strong> '
        "left the studio and is heading your way.</p>"
        + _info_card([
            ("Order", "#{{order_number}}"),
            ("Tracking", "{{tracking_code}}"),
        ])
        + '<p style="margin:0;white-space:pre-wrap;">{{tracking_info}}</p>'
    )
    return _shell(
        preheader="Order {{order_number}} is on the way.",
        eyebrow="On the way",
        title="Your order has shipped.",
        body_html=body,
        cta_label="Track shipment",
        cta_url="https://koleqcia.com/account/orders",
    )


def custom_order_shipped_html() -> str:
    body = (
        '<p style="margin:0 0 12px;color:' + INK + ';font-size:16px;font-weight:600;">Hi {{customer_name}},</p>'
        "<p style=\"margin:0;\">Your one-of-a-kind order is packed and in transit. Use the details below to track it — "
        "and complete payment if a balance remains.</p>"
        + _info_card([("Tracking", "{{tracking_code}}")])
    )
    return _shell(
        preheader="Your custom piece is on the way — complete payment if needed.",
        eyebrow="Custom order",
        title="Your custom piece shipped.",
        body_html=body,
        cta_label="Complete payment",
        cta_url="{{payment_link}}",
    )


def auction_new_html() -> str:
    body = (
        '<p style="margin:0 0 20px;">A new drop just opened. Be early — limited pieces go fast.</p>'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">'
        '<tr><td align="center" style="background:' + INK + ';padding:0;">'
        '<img src="{{image_url}}" alt="{{auction_title}}" width="520" '
        'style="display:block;width:100%;max-width:520px;height:auto;border:0;">'
        "</td></tr></table>"
        + _info_card([
            ("Starting bid", "{{starting_bid}}"),
            ("Opens", "{{starts_at}}"),
        ])
    )
    return _shell(
        preheader="New auction live: {{auction_title}}",
        eyebrow="Live auction",
        title="{{auction_title}}",
        body_html=body,
        cta_label="Place a bid",
        cta_url="{{auction_url}}",
    )


def auction_won_html() -> str:
    body = (
        '<p style="margin:0 0 12px;color:' + INK + ';font-size:16px;font-weight:600;">The gavel fell in your favor.</p>'
        '<p style="margin:0;">You won <strong style="color:' + INK + ';">{{auction_title}}</strong>. '
        "Complete payment to secure your piece — we'll handle the rest.</p>"
        + _info_card([("Winning bid", "{{winning_amount}}")])
        + '<p style="margin:16px 0 0;padding:14px 16px;background:#fff8e8;border-left:3px solid ' + GOLD + ";"
        "color:" + INK + ';font-size:13px;">Payment link expires soon. Tap below to finish checkout.</p>'
    )
    return _shell(
        preheader="You won {{auction_title}} — complete payment to claim it.",
        eyebrow="You won",
        title="Congratulations, {{winner_name}}!",
        body_html=body,
        cta_label="Pay & claim",
        cta_url="{{payment_link}}",
    )


def password_reset_html() -> str:
    body = (
        '<p style="margin:0 0 12px;color:' + INK + ';font-size:16px;font-weight:600;">Hi {{user_name}},</p>'
        "<p style=\"margin:0;\">We received a request to reset your Koleqcia password. If that was you, use the button below. "
        "The link expires soon for your security.</p>"
        '<p style="margin:20px 0 0;padding:14px 16px;background:' + BG + ";border:1px solid " + BORDER + ";"
        'font-size:12px;word-break:break-all;color:' + MUTED + ';">'
        'Or paste this URL:<br><a href="{{reset_url}}" style="color:' + CTA + ';">{{reset_url}}</a></p>'
        '<p style="margin:20px 0 0;font-size:13px;">Didn\'t request this? You can ignore this email — your password stays unchanged.</p>'
    )
    return _shell(
        preheader="Reset your Koleqcia password — link inside.",
        eyebrow="Security",
        title="Reset your password",
        body_html=body,
        cta_label="Reset password",
        cta_url="{{reset_url}}",
    )


def welcome_html() -> str:
    body = (
        '<p style="margin:0 0 12px;color:' + INK + ';font-size:16px;font-weight:600;">Glad you\'re here.</p>'
        "<p style=\"margin:0 0 16px;\">Koleqcia is home to artist-made metal posters, premium figures, and custom prints — "
        "built to last, made in Georgia.</p>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;">'
        '<tr><td style="padding:14px 16px;border:1px solid ' + BORDER + ";background:" + BG + ';">'
        '<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:' + GOLD + ';font-weight:700;">Explore</p>'
        '<p style="margin:0;color:' + INK + ';font-size:14px;font-weight:600;">Wallpanels · Figures · Auctions · Custom</p>'
        "</td></tr></table>"
        '<p style="margin:0;">Start with what speaks to you — your walls (and shelves) will thank you.</p>'
    )
    return _shell(
        preheader="Welcome to Koleqcia — metal art made in Georgia.",
        eyebrow="Welcome",
        title="You're in, {{user_name}}.",
        body_html=body,
        cta_label="Shop the catalog",
        cta_url="https://koleqcia.com/catalog",
    )


def custom_html() -> str:
    body = (
        '<p style="margin:0 0 12px;color:' + INK + ';font-size:16px;font-weight:600;">Hello,</p>'
        "<p style=\"margin:0;\">Edit this template in the admin Email Templates editor to craft one-off announcements, "
        "promos, or studio updates.</p>"
        '<p style="margin:20px 0 0;padding:14px 16px;border-left:3px solid ' + CTA + ";background:" + BG + ";"
        "color:" + INK + ';font-size:14px;">'
        "Tip: use the visual editor to swap headlines, add images, and drop in your CTA.</p>"
    )
    return _shell(
        preheader="A message from Koleqcia.",
        eyebrow="Koleqcia",
        title="A note for you",
        body_html=body,
        cta_label="Visit Koleqcia",
        cta_url="https://koleqcia.com",
    )


_HTML_BUILDERS = {
    "order_confirmed": order_confirmed_html,
    "order_shipped": order_shipped_html,
    "custom_order_shipped": custom_order_shipped_html,
    "auction_new": auction_new_html,
    "auction_won": auction_won_html,
    "password_reset": password_reset_html,
    "welcome": welcome_html,
    "custom": custom_html,
}

_META = [
    ("order_confirmed", "Order Confirmed", "Order #{{order_number}} confirmed — thank you!",
     ["customer_name", "order_number", "total", "currency", "items"]),
    ("order_shipped", "Order Shipped", "Your order #{{order_number}} has shipped!",
     ["customer_name", "order_number", "tracking_code", "tracking_info"]),
    ("custom_order_shipped", "Custom Order Shipped", "Your custom order is on the way",
     ["customer_name", "tracking_code", "payment_link"]),
    ("auction_new", "New Auction Notification", "New auction: {{auction_title}}",
     ["auction_title", "starting_bid", "starts_at", "image_url", "auction_url"]),
    ("auction_won", "Auction Won", "You won {{auction_title}}!",
     ["winner_name", "auction_title", "winning_amount", "payment_link"]),
    ("password_reset", "Password Reset", "Reset your Koleqcia password",
     ["reset_url", "user_name"]),
    ("welcome", "Welcome / Registration", "Welcome to Koleqcia, {{user_name}}!",
     ["user_name"]),
    ("custom", "Custom / One-off", "A message from Koleqcia", []),
]


def get_default_templates() -> list[dict]:
    out = []
    for event_key, name, subject, variables in _META:
        out.append({
            "event_key": event_key,
            "name": name,
            "subject": subject,
            "variables": variables,
            "html_body": _HTML_BUILDERS[event_key](),
            "design_json": {},
            "is_active": True,
            "vendor": None,
        })
    return out


def install_default_templates(*, overwrite: bool = False) -> dict:
    """Create / update platform-wide EmailTemplate rows for every event type."""
    from .models import EmailTemplate

    created = updated = skipped = 0
    for payload in get_default_templates():
        event_key = payload["event_key"]
        existing = EmailTemplate.objects.filter(event_key=event_key, vendor__isnull=True).first()
        if existing:
            if not overwrite:
                skipped += 1
                continue
            existing.name = payload["name"]
            existing.subject = payload["subject"]
            existing.html_body = payload["html_body"]
            existing.variables = payload["variables"]
            existing.is_active = True
            existing.save(update_fields=["name", "subject", "html_body", "variables", "is_active", "updated_at"])
            updated += 1
        else:
            EmailTemplate.objects.create(**payload)
            created += 1
    return {"created": created, "updated": updated, "skipped": skipped}
