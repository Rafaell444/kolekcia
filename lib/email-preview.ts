/** Sample values so admin Preview shows real-looking product images & prices. */

const SAMPLE_PRODUCT_IMG =
  "https://placehold.co/144x144/111113/ffffff?text=Product"

const SAMPLE_AUCTION_IMG =
  "https://placehold.co/520x320/111113/f0a30a?text=Auction"

const SAMPLE_ITEMS_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;width:88px;">
      <img src="${SAMPLE_PRODUCT_IMG}" alt="Product" width="72" height="72"
        style="display:block;width:72px;height:72px;object-fit:cover;border:0;border-radius:2px;background:#111113;">
    </td>
    <td style="padding:14px 12px;border-bottom:1px solid #e5e5e7;vertical-align:top;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111113;">Crystal Forest</p>
      <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#aeaeb2;">M · Alex Tanaka</p>
      <p style="margin:6px 0 0;font-size:12px;color:#198040;line-height:1.4;">Processing: Standard<br>Gift wrap — Happy birthday!</p>
      <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#636366;">Qty 1 · 59.99 ₾ each</p>
    </td>
    <td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;text-align:right;white-space:nowrap;">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111113;">59.99 ₾</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;width:88px;">
      <img src="${SAMPLE_PRODUCT_IMG}" alt="Product" width="72" height="72"
        style="display:block;width:72px;height:72px;object-fit:cover;border:0;border-radius:2px;background:#111113;">
    </td>
    <td style="padding:14px 12px;border-bottom:1px solid #e5e5e7;vertical-align:top;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111113;">Event Horizon</p>
      <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#aeaeb2;">L · Alex Tanaka</p>
      <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#636366;">Qty 2 · 44.99 ₾ each</p>
    </td>
    <td style="padding:14px 0;border-bottom:1px solid #e5e5e7;vertical-align:top;text-align:right;white-space:nowrap;">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#111113;">89.98 ₾</span>
    </td>
  </tr>
</table>
`.trim()

const SAMPLE_TOTALS_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;">
  <tr><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#636366;">Subtotal</td><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#636366;text-align:right;">149.97 ₾</td></tr>
  <tr><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#636366;">Gift wrap</td><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#636366;text-align:right;">5.00 ₾</td></tr>
  <tr><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#636366;">Standard</td><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#636366;text-align:right;">10.00 ₾</td></tr>
  <tr><td style="padding:8px 0;border-top:1px solid #e5e5e7;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111113;font-weight:800;">Total</td><td style="padding:8px 0;border-top:1px solid #e5e5e7;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111113;font-weight:800;text-align:right;">164.97 ₾</td></tr>
</table>
`.trim()

const SAMPLE_ADDRESS_HTML = `
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#636366;">
  Nino Beridze<br>
  12 Rustaveli Ave<br>
  Tbilisi, 0108<br>
  Georgia
</p>
`.trim()

const SAMPLE_BY_EVENT: Record<string, Record<string, string>> = {
  order_confirmed: {
    customer_name: "Nino",
    order_number: "KOL-2026-104821",
    total: "164.97 ₾",
    currency: "GEL",
    items: "Crystal Forest × 1 — 59.99 ₾\nEvent Horizon × 2 — 89.98 ₾",
    items_html: SAMPLE_ITEMS_HTML,
    totals_html: SAMPLE_TOTALS_HTML,
    shipping_address_html: SAMPLE_ADDRESS_HTML,
  },
  order_shipped: {
    customer_name: "Nino",
    order_number: "KOL-2026-104821",
    tracking_code: "GE123456789GE",
    tracking_info: "Tracking number: GE123456789GE",
    total: "164.97 ₾",
    items_html: SAMPLE_ITEMS_HTML,
    totals_html: SAMPLE_TOTALS_HTML,
    shipping_address_html: SAMPLE_ADDRESS_HTML,
  },
  custom_order_shipped: {
    customer_name: "Nino",
    tracking_code: "GE987654321GE",
    payment_link: "https://koleqcia.com/pay/sample",
    product_image: SAMPLE_PRODUCT_IMG,
    total: "120.00 ₾",
  },
  auction_new: {
    auction_title: "Limited Metal Drop — Void Horizon",
    starting_bid: "80.00 ₾",
    starts_at: "July 25, 2026 at 18:00 UTC",
    image_url: SAMPLE_AUCTION_IMG,
    auction_url: "https://koleqcia.com/auctions/sample",
  },
  auction_won: {
    winner_name: "Nino",
    auction_title: "Limited Metal Drop — Void Horizon",
    winning_amount: "145.00 ₾",
    payment_link: "https://koleqcia.com/pay/sample",
  },
  password_reset: {
    user_name: "Nino",
    reset_url: "https://koleqcia.com/reset-password?token=sample",
  },
}

export function renderEmailPreviewHtml(html: string, eventKey: string): string {
  if (!html) return ""
  const samples = SAMPLE_BY_EVENT[eventKey] || {}
  let out = html
  for (const [key, value] of Object.entries(samples)) {
    out = out.replaceAll(`{{${key}}}`, value)
  }
  // Any leftover placeholders → visible chips so nothing looks “missing”
  out = out.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => {
    if (name.toLowerCase().includes("image") || name.toLowerCase().includes("img")) {
      return SAMPLE_PRODUCT_IMG
    }
    return `[${name}]`
  })
  return out
}
