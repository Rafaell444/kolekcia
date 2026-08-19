"""Build rich order email context (items with images, prices, extras)."""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings


def absolute_media_url(url: str) -> str:
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = getattr(settings, "BACKEND_PUBLIC_URL", None) or getattr(settings, "FRONTEND_URL", "")
    # Prefer API host for /media/ paths
    api = getattr(settings, "BACKEND_PUBLIC_URL", "") or ""
    if url.startswith("/media/") and api:
        return api.rstrip("/") + url
    if url.startswith("/"):
        host = api or base
        return host.rstrip("/") + url if host else url
    return url


def _money(amount, currency: str) -> str:
    try:
        n = Decimal(str(amount))
    except Exception:
        n = Decimal("0")
    formatted = f"{n:.2f}"
    if currency == "GEL":
        return f"{formatted} ₾"
    if currency == "EUR":
        return f"€{formatted}"
    if currency == "GBP":
        return f"£{formatted}"
    return f"${formatted}"


def _processing_label(slug: str) -> str:
    if not slug:
        return ""
    try:
        from apps.orders.models import ProcessingOption
        opt = ProcessingOption.objects.filter(slug=slug).first()
        if opt:
            return opt.label
    except Exception:
        pass
    return slug.replace("-", " ").replace("_", " ").title()


def render_order_items_html(order) -> str:
    """HTML block of line items for transactional emails."""
    currency = order.currency or "USD"
    rows = []
    for item in order.items.all():
        img = absolute_media_url(item.product_image or "")
        img_cell = (
            f'<img src="{img}" alt="{item.product_title}" width="88" height="88" '
            'style="display:block;width:88px;height:88px;object-fit:cover;border:1px solid #e5e5e7;border-radius:2px;background:#111113;">'
            if img
            else (
                '<table role="presentation" width="88" height="88" cellpadding="0" cellspacing="0" border="0" '
                'style="width:88px;height:88px;background:#111113;border:1px solid #e5e5e7;">'
                '<tr><td align="center" valign="middle" style="font-family:Arial,Helvetica,sans-serif;'
                'font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">Product</td></tr></table>'
            )
        )

        meta_bits = []
        if item.size_label:
            meta_bits.append(item.size_label)
        if item.finish_label:
            meta_bits.append(item.finish_label)
        if item.frame_label:
            meta_bits.append(item.frame_label)
        if item.artist_name:
            meta_bits.append(item.artist_name)
        meta = " · ".join(meta_bits)

        extras = []
        if item.processing_option:
            label = getattr(item, "processing_label", "") or _processing_label(item.processing_option)
            days = getattr(item, "processing_days", "") or ""
            fee = Decimal(getattr(item, "processing_fee", 0) or 0)
            bits = [label]
            if days:
                bits.append(days)
            if fee > 0:
                bits.append(f"+{_money(fee, currency)}")
            elif label:
                bits.append("Included")
            extras.append("Processing: " + " · ".join(bits))
        if item.gift_wrap:
            note = f" — {item.gift_wrap_note}" if item.gift_wrap_note else ""
            extras.append(f"Gift wrap{note}")
        extras_html = ""
        if extras:
            extras_html = (
                '<p style="margin:6px 0 0;font-size:12px;color:#198040;line-height:1.4;">'
                + "<br>".join(extras)
                + "</p>"
            )

        unit = _money(item.price, currency)
        # Line shows product only; processing/gift wrap are in order totals
        line = _money(Decimal(item.price) * item.quantity, currency)

        rows.append(
            f"""
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;width:100px;">{img_cell}</td>
              <td style="padding:14px 12px;border-bottom:1px solid #e5e5e7;vertical-align:top;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111113;">
                  {item.product_title}
                </p>
                <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#aeaeb2;">
                  {meta}
                </p>
                {extras_html}
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#636366;">
                  Qty {item.quantity} · {unit} each
                </p>
              </td>
              <td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;text-align:right;white-space:nowrap;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111113;">{line}</span>
              </td>
            </tr>
            """
        )

    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:8px 0 4px;">'
        + "".join(rows)
        + "</table>"
    )


def render_order_totals_html(order) -> str:
    currency = order.currency or "USD"
    # subtotal = products only; extras + shipping are separate line items
    lines = [
        ("Products", _money(order.subtotal, currency)),
    ]
    if order.gift_wrap_total and Decimal(order.gift_wrap_total) > 0:
        lines.append(("Gift wrap", _money(order.gift_wrap_total, currency)))
    processing_total = getattr(order, "processing_fee_total", None)
    if processing_total and Decimal(processing_total) > 0:
        lines.append(("Processing", _money(processing_total, currency)))
    if order.delivery_price and Decimal(order.delivery_price) > 0:
        dtype = (order.delivery_type or "shipping").replace("_", " ").title()
        lines.append((dtype, _money(order.delivery_price, currency)))
    if order.discount and Decimal(order.discount) > 0:
        lines.append(("Discount", f"-{_money(order.discount, currency)}"))
    lines.append(("Total", _money(order.total, currency)))

    rows = []
    for i, (label, value) in enumerate(lines):
        is_total = i == len(lines) - 1
        weight = "800" if is_total else "400"
        color = "#111113" if is_total else "#636366"
        border = "border-top:1px solid #e5e5e7;" if is_total else ""
        rows.append(
            f'<tr><td style="padding:8px 0;{border}font-family:Arial,Helvetica,sans-serif;'
            f'font-size:13px;color:{color};font-weight:{weight};">{label}</td>'
            f'<td style="padding:8px 0;{border}font-family:Arial,Helvetica,sans-serif;'
            f'font-size:13px;color:{color};font-weight:{weight};text-align:right;">{value}</td></tr>'
        )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:16px 0 0;">'
        + "".join(rows)
        + "</table>"
    )


def render_shipping_address_html(order) -> str:
    parts = [
        order.shipping_name or "",
        order.shipping_line1 or "",
        order.shipping_line2 or "",
        f"{order.shipping_city or ''}, {order.shipping_state or ''} {order.shipping_zip or ''}".strip(", "),
        order.shipping_country or "",
    ]
    text = "<br>".join(p for p in parts if p and str(p).strip())
    return (
        f'<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;'
        f'line-height:1.6;color:#636366;">{text}</p>'
    )


def loyalty_points_context(order) -> dict:
    try:
        from apps.gamification.models import PointTransaction
        earned = list(
            PointTransaction.objects.filter(
                order=order,
                transaction_type=PointTransaction.TYPE_EARNED,
            )
        )
    except Exception:
        earned = []
    points = sum(tx.points for tx in earned)
    has_available = any(tx.status == "available" for tx in earned)
    status = "spendable" if points > 0 and has_available else "pending until shipment"
    message = (
        f"You earned {points} Koleqcia points from this order. They are already spendable in your Points Market."
        if points > 0 and has_available
        else f"You earned {points} Koleqcia points from this order. They will become spendable when your order ships."
        if points > 0
        else "No loyalty points were earned for this order."
    )
    return {
        "points_earned": str(points),
        "points_status": status,
        "points_message": message,
    }


def build_shipment_email_context(order, shipment) -> dict:
    """Context for per-vendor shipment notification emails."""
    currency = order.currency or "USD"
    tracking = shipment.tracking_code or ""
    tracking_info = f"Tracking number: {tracking}" if tracking else "We'll share tracking as soon as it's available."
    vendor_name = shipment.vendor.name if shipment.vendor else "your vendor"

    # Only include items from this shipment
    shipment_items = order.items.filter(shipment=shipment)
    items_plain = []
    for item in shipment_items:
        line = f"{item.product_title} × {item.quantity} — {_money(item.line_total, currency)}"
        items_plain.append(line)

    # Render items HTML for this shipment only
    rows = []
    for item in shipment_items:
        img = absolute_media_url(item.product_image or "")
        img_cell = (
            f'<img src="{img}" alt="{item.product_title}" width="88" height="88" '
            'style="display:block;width:88px;height:88px;object-fit:cover;border:1px solid #e5e5e7;border-radius:2px;background:#111113;">'
            if img
            else (
                '<table role="presentation" width="88" height="88" cellpadding="0" cellspacing="0" border="0" '
                'style="width:88px;height:88px;background:#111113;border:1px solid #e5e5e7;">'
                '<tr><td align="center" valign="middle" style="font-family:Arial,Helvetica,sans-serif;'
                'font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">Product</td></tr></table>'
            )
        )
        unit = _money(item.price, currency)
        line_total = _money(Decimal(item.price) * item.quantity, currency)
        meta_bits = [item.size_label, item.finish_label, item.frame_label, item.artist_name]
        meta = " · ".join(b for b in meta_bits if b)
        rows.append(
            f'<tr><td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;width:100px;">{img_cell}</td>'
            f'<td style="padding:14px 12px;border-bottom:1px solid #e5e5e7;vertical-align:top;">'
            f'<p style="margin:0;font-size:14px;font-weight:700;color:#111113;">{item.product_title}</p>'
            f'<p style="margin:4px 0 0;font-size:12px;color:#aeaeb2;">{meta}</p>'
            f'<p style="margin:8px 0 0;font-size:12px;color:#636366;">Qty {item.quantity} · {unit} each</p>'
            f'</td>'
            f'<td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;text-align:right;white-space:nowrap;">'
            f'<span style="font-size:14px;font-weight:700;color:#111113;">{line_total}</span></td></tr>'
        )
    items_html = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">'
        + "".join(rows) + "</table>"
    )

    context = {
        "customer_name": order.shipping_name or "there",
        "order_number": order.order_number,
        "vendor_name": vendor_name,
        "total": _money(order.total, currency),
        "currency": currency,
        "items": "\n".join(items_plain),
        "items_html": items_html,
        "shipping_address_html": render_shipping_address_html(order),
        "tracking_code": tracking or "—",
        "tracking_info": tracking_info,
        "delivery_label": shipment.delivery_label or "",
        "delivery_price": _money(shipment.delivery_price, currency),
    }
    context.update(loyalty_points_context(order))
    return context


def build_order_email_context(order) -> dict:
    """Context for order_confirmed / order_shipped templates."""
    currency = order.currency or "USD"
    tracking = order.tracking_code or ""
    tracking_info = f"Tracking number: {tracking}" if tracking else "We'll share tracking as soon as it's available."

    items_plain = []
    for item in order.items.all():
        line = f"{item.product_title} × {item.quantity} — {_money(item.line_total, currency)}"
        if item.processing_option:
            label = getattr(item, "processing_label", "") or _processing_label(item.processing_option)
            days = getattr(item, "processing_days", "") or ""
            fee = Decimal(getattr(item, "processing_fee", 0) or 0)
            detail = label
            if days:
                detail += f" ({days})"
            if fee > 0:
                detail += f" +{_money(fee, currency)}"
            line += f" | Processing: {detail}"
        if item.gift_wrap:
            line += " | Gift wrap"
        items_plain.append(line)

    context = {
        "customer_name": order.shipping_name or "there",
        "order_number": order.order_number,
        "total": _money(order.total, currency),
        "currency": currency,
        "subtotal": _money(order.subtotal, currency),
        "discount": _money(order.discount, currency),
        "delivery_price": _money(order.delivery_price, currency),
        "gift_wrap_total": _money(order.gift_wrap_total, currency),
        "items": "\n".join(items_plain),
        "items_html": render_order_items_html(order),
        "totals_html": render_order_totals_html(order),
        "shipping_address_html": render_shipping_address_html(order),
        "tracking_code": tracking or "—",
        "tracking_info": tracking_info,
    }
    context.update(loyalty_points_context(order))

    # Include per-vendor shipment info if available
    shipments = list(order.shipments.select_related("vendor").all()) if hasattr(order, "shipments") else []
    if shipments:
        shipment_lines = []
        for s in shipments:
            vendor_label = s.vendor.name if s.vendor else "Unknown"
            s_tracking = s.tracking_code or "pending"
            shipment_lines.append(f"{vendor_label}: {s.delivery_label} — tracking: {s_tracking}")
        context["shipments_info"] = "\n".join(shipment_lines)

    return context
