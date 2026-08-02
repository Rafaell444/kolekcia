"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { ArrowLeft, Package, Truck, Clock, CheckCircle, XCircle, Save, CalendarClock } from "lucide-react"
import { formatAmount } from "@/lib/product-pricing"
import type { Currency } from "@/contexts/locale-context"

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"

type OrderItem = {
  id: number
  product_title: string
  product_image: string
  artist_name: string
  size_label: string
  finish_label: string
  frame_label: string
  price: string
  quantity: number
  line_total: string
  processing_option: string
  gift_wrap?: boolean
  gift_wrap_note?: string
  gift_wrap_image_url?: string
  vendor_id?: number | null
  vendor_name?: string | null
  shipment_id?: number | null
}

type Shipment = {
  id: number
  vendor: number | null
  vendor_name: string
  delivery_type: string
  delivery_label: string
  delivery_price: string
  tracking_code: string
  shipped_at: string | null
  status: string
  created_at: string
}

type ProcessingOpt = {
  id: number; slug: string; label: string; est_days_min: number; est_days_max: number
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

function getProcessingInfo(item: OrderItem, opts: ProcessingOpt[]): { label: string; days: number } {
  if (!item.processing_option) return { label: "Standard (Figure)", days: 25 }
  const opt = opts.find((o) => o.slug === item.processing_option)
  return opt ? { label: opt.label, days: opt.est_days_max } : { label: item.processing_option, days: 25 }
}

type StatusHistory = {
  id: number
  status: string
  note: string
  changed_by_email: string | null
  changed_at: string
}

type OrderDetail = {
  id: string
  order_number: string
  status: OrderStatus
  items: OrderItem[]
  shipments: Shipment[]
  status_history: StatusHistory[]
  shipping_name: string
  shipping_line1: string
  shipping_line2: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  shipping_country: string
  shipping_email: string
  shipping_phone: string
  subtotal: string
  discount: string
  delivery_price: string
  total: string
  currency: string
  promo_code_str: string | null
  tracking_code: string
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.FC<{ size?: number }> }> = {
  pending:    { label: "Pending",    color: "text-dp-accent-gold",  bg: "bg-dp-accent-gold/10 border-dp-accent-gold/30",  Icon: Clock       },
  processing: { label: "Processing", color: "text-blue-400",        bg: "bg-blue-400/10 border-blue-400/30",              Icon: Package     },
  shipped:    { label: "Shipped",    color: "text-dp-accent-cta",   bg: "bg-dp-accent-cta/10 border-dp-accent-cta/30",    Icon: Truck       },
  delivered:  { label: "Delivered",  color: "text-dp-success",      bg: "bg-dp-success/10 border-dp-success/30",          Icon: CheckCircle },
  cancelled:  { label: "Cancelled",  color: "text-dp-text-tertiary",bg: "bg-dp-bg-elevated border-dp-border",             Icon: XCircle     },
}

const SHIPMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  processing: { label: "Processing", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  shipped:    { label: "Shipped",    color: "text-dp-accent-cta", bg: "bg-dp-accent-cta/10 border-dp-accent-cta/30" },
  delivered:  { label: "Delivered",  color: "text-dp-success", bg: "bg-dp-success/10 border-dp-success/30" },
}

function ShipmentCard({
  shipment, order, onUpdate,
}: {
  shipment: Shipment; order: OrderDetail; onUpdate: (updated: OrderDetail) => void
}) {
  const [tracking, setTracking] = useState(shipment.tracking_code)
  const [shipmentStatus, setShipmentStatus] = useState(shipment.status)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const items = order.items.filter((i) => i.shipment_id === shipment.id)
  const cfg = SHIPMENT_STATUS_CONFIG[shipment.status] ?? SHIPMENT_STATUS_CONFIG.processing
  const hasChanges = tracking !== shipment.tracking_code || shipmentStatus !== shipment.status

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await adminFetch<OrderDetail>(`/admin/orders/${order.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          shipment_id: shipment.id,
          tracking_code: tracking,
          shipment_status: shipmentStatus,
        }),
      })
      onUpdate(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-dp-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-dp-accent-cta" />
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-dp-text-primary">
            {shipment.vendor_name || "Vendor"}
          </h3>
          <span className="text-[11px] text-dp-text-tertiary">· {shipment.delivery_label}</span>
          <span className="text-[11px] text-dp-text-tertiary">· {formatAmount(parseFloat(shipment.delivery_price), order.currency as Currency)}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-widest ${cfg.color} ${cfg.bg}`}>
          {cfg.label}
        </span>
      </div>

      {items.length > 0 && (
        <div className="px-4 py-2 border-b border-dp-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-1.5">
              <div className="w-8 h-10 shrink-0 rounded-sm overflow-hidden bg-dp-bg-elevated border border-dp-border">
                {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-dp-text-primary truncate">{item.product_title}</p>
                <p className="text-[11px] text-dp-text-tertiary">×{item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Status</label>
            <select
              value={shipmentStatus}
              onChange={(e) => setShipmentStatus(e.target.value)}
              className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
            >
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
              Tracking Number
              {shipmentStatus === "shipped" && <span className="text-dp-accent-cta ml-1">— emailed to customer</span>}
            </label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. GE123456789GE"
              className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary"
            />
          </div>
        </div>

        {shipment.shipped_at && (
          <p className="text-[11px] text-dp-text-tertiary">
            Shipped: {new Date(shipment.shipped_at).toLocaleString()}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
          >
            <Save size={12} /> {saving ? "Saving…" : saved ? "Saved!" : "Update Shipment"}
          </button>
          {saved && <span className="text-[11px] text-dp-success">✓ Updated</span>}
        </div>
      </form>
    </div>
  )
}

export default function AdminOrderDetailPage(): React.ReactElement {
  const params = useParams()
  const orderId = params?.id as string
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [processingOpts, setProcessingOpts] = useState<ProcessingOpt[]>([])

  const [newStatus, setNewStatus] = useState<string>("")
  const [trackingCode, setTrackingCode] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = Boolean(adminUser && !adminUser.is_staff && adminUser.vendor)

  const hasShipments = (order?.shipments?.length ?? 0) > 0

  useEffect(() => {
    adminFetch<ProcessingOpt[]>("/admin/processing-options/")
      .then(setProcessingOpts)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    adminFetch<OrderDetail>(`/admin/orders/${orderId}/`)
      .then((data) => {
        if (!cancelled) {
          setOrder(data)
          setNewStatus(data.status)
          setTrackingCode(data.tracking_code ?? "")
        }
      })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orderId])

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!order) return
    setSaving(true)
    try {
      const body: Record<string, string> = { status: newStatus, note, tracking_code: trackingCode }
      const updated = await adminFetch<OrderDetail>(`/admin/orders/${orderId}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      setOrder(updated)
      setNewStatus(updated.status)
      setTrackingCode(updated.tracking_code ?? "")
      setNote("")
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="animate-pulse h-8 w-48 bg-dp-bg-elevated rounded-sm mb-6" />
        <div className="animate-pulse h-64 bg-dp-bg-elevated rounded-sm" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="p-4 sm:p-8">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary hover:text-dp-text-primary mb-6">
          <ArrowLeft size={14} /> Back to orders
        </Link>
        <p className="text-dp-text-tertiary">Order not found.</p>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6 max-w-5xl">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary hover:text-dp-text-primary w-fit">
        <ArrowLeft size={14} /> Back to orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">{order.order_number}</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">
            Placed {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[12px] font-bold uppercase tracking-widest w-fit ${cfg.color} ${cfg.bg}`}>
          <cfg.Icon size={14} /> {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Line Items */}
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-dp-border">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Line Items</h2>
            </div>
            <ul className="divide-y divide-dp-border">
              {order.items.map((item) => (
                <li key={item.id} className="px-4 py-4 flex gap-4">
                  <div className="w-14 h-18 shrink-0 rounded-sm overflow-hidden bg-dp-bg-elevated border border-dp-border">
                    {item.product_image && (
                      <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-dp-text-primary">{item.product_title}</p>
                    <p className="text-[12px] text-dp-text-tertiary">{item.artist_name}</p>
                    <p className="text-[11px] text-dp-text-tertiary mt-1">
                      {[item.size_label, item.finish_label, item.frame_label].filter(Boolean).join(" · ")}
                    </p>
                    {item.vendor_name && (
                      <p className="text-[10px] text-dp-text-tertiary mt-0.5">Vendor: {item.vendor_name}</p>
                    )}
                    {item.gift_wrap && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-dp-accent-cta bg-dp-accent-cta/10 border border-dp-accent-cta/20 rounded-sm px-2 py-0.5 w-fit">
                          🎁 Gift wrapped
                        </span>
                        {item.gift_wrap_image_url && (
                          <a href={item.gift_wrap_image_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-0.5">
                            <img src={item.gift_wrap_image_url} alt="Engraving design" className="w-16 h-16 object-cover rounded-sm border border-dp-border hover:opacity-80 transition-opacity" />
                          </a>
                        )}
                        {item.gift_wrap_note && (
                          <p className="text-[11px] text-dp-text-secondary italic">
                            &ldquo;{item.gift_wrap_note}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] text-dp-text-secondary">×{item.quantity}</p>
                    <p className="text-[14px] font-bold text-dp-text-primary">{formatAmount(parseFloat(item.line_total), order.currency as Currency)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Per-Vendor Shipments */}
          {hasShipments && (
            <div className="flex flex-col gap-4">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary flex items-center gap-2">
                <Truck size={14} className="text-dp-accent-cta" />
                Vendor Shipments ({order.shipments.length})
              </h2>
              {order.shipments.map((shipment) => (
                <ShipmentCard
                  key={shipment.id}
                  shipment={shipment}
                  order={order}
                  onUpdate={(updated) => {
                    setOrder(updated)
                    setNewStatus(updated.status)
                    setTrackingCode(updated.tracking_code ?? "")
                  }}
                />
              ))}
            </div>
          )}

          {/* Processing Timeline */}
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-dp-border flex items-center gap-2">
              <CalendarClock size={14} className="text-dp-accent-cta" />
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Processing Timeline</h2>
            </div>
            <ul className="divide-y divide-dp-border">
              {order.items.map((item) => {
                const info = getProcessingInfo(item, processingOpts)
                const deadline = addBusinessDays(new Date(order.created_at), info.days)
                const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                const isOverdue = daysLeft < 0
                const isDueSoon = !isOverdue && daysLeft <= 3
                return (
                  <li key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-dp-text-primary truncate">{item.product_title}</p>
                      <p className="text-[11px] text-dp-text-tertiary">{info.label} · {info.days} business days</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Ship by</p>
                        <p className="text-[13px] font-bold text-dp-text-primary">
                          {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className={`w-16 px-2 py-1.5 rounded-sm text-center border ${
                        isOverdue
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : isDueSoon
                          ? "bg-dp-accent-gold/10 border-dp-accent-gold/30 text-dp-accent-gold"
                          : "bg-dp-bg-elevated border-dp-border text-dp-text-secondary"
                      }`}>
                        <p className="text-[20px] font-bold leading-none">{Math.abs(daysLeft)}</p>
                        <p className="text-[9px] uppercase tracking-widest leading-tight">
                          {isOverdue ? "overdue" : "days left"}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Legacy Status Update (for orders without shipments or whole-order actions) */}
          {!hasShipments && (
            <form onSubmit={(e) => void handleUpdateStatus(e)} className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-dp-border">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Update Order Status</h2>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  {newStatus === "shipped" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                        Tracking Number
                        <span className="text-dp-accent-cta ml-1">— will be emailed to customer</span>
                      </label>
                      <input
                        value={trackingCode}
                        onChange={(e) => setTrackingCode(e.target.value)}
                        placeholder="e.g. GE123456789GE"
                        className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Internal Note (optional)</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for status change…"
                    className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                  />
                </div>

                {newStatus === "shipped" && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-dp-accent-cta/5 border border-dp-accent-cta/20 rounded-sm">
                    <Truck size={14} className="text-dp-accent-cta shrink-0 mt-0.5" />
                    <p className="text-[12px] text-dp-text-secondary">
                      A shipping confirmation email will be sent to <strong className="text-dp-text-primary">{order.shipping_email}</strong>
                      {trackingCode ? <> with tracking number <strong className="text-dp-text-primary">{trackingCode}</strong></> : null}.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving || (newStatus === order.status && trackingCode === (order.tracking_code ?? ""))}
                    className="flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
                  >
                    <Save size={13} /> {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
                  </button>
                  {saved && <span className="text-[12px] text-dp-success">✓ Order updated</span>}
                </div>
              </div>
            </form>
          )}

          {/* For orders WITH shipments, show a simpler overall status control */}
          {hasShipments && (
            <form onSubmit={(e) => void handleUpdateStatus(e)} className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-dp-border">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Overall Order Status</h2>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <p className="text-[12px] text-dp-text-secondary">
                  Use the shipment cards above to update tracking per vendor. The order status will auto-advance to &ldquo;Shipped&rdquo; when all vendor shipments are shipped.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Override Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Internal Note</label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional…"
                      className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving || newStatus === order.status}
                    className="flex items-center gap-2 px-4 py-2 bg-dp-bg-elevated border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50 hover:text-dp-text-primary"
                  >
                    <Save size={12} /> {saving ? "Saving…" : "Override Status"}
                  </button>
                  {saved && <span className="text-[11px] text-dp-success">✓ Updated</span>}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3">Totals</h2>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-dp-text-tertiary">Subtotal</dt><dd>{formatAmount(parseFloat(order.subtotal), order.currency as Currency)}</dd></div>
              {parseFloat(order.discount) > 0 && (
                <div className="flex justify-between"><dt className="text-dp-text-tertiary">Discount{order.promo_code_str ? ` (${order.promo_code_str})` : ""}</dt><dd className="text-dp-success">-{formatAmount(parseFloat(order.discount), order.currency as Currency)}</dd></div>
              )}
              {parseFloat(order.delivery_price) > 0 && (
                <div className="flex justify-between"><dt className="text-dp-text-tertiary">Shipping</dt><dd>{formatAmount(parseFloat(order.delivery_price), order.currency as Currency)}</dd></div>
              )}
              <div className="flex justify-between font-bold text-dp-text-primary pt-2 border-t border-dp-border">
                <dt>Total</dt><dd>{formatAmount(parseFloat(order.total), order.currency as Currency)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3">Shipping Address</h2>
            <p className="text-[13px] text-dp-text-primary font-semibold">{order.shipping_name}</p>
            <p className="text-[12px] text-dp-text-secondary mt-1 leading-relaxed">
              {order.shipping_line1}
              {order.shipping_line2 ? <><br />{order.shipping_line2}</> : null}
              <br />
              {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
              <br />
              {order.shipping_country}
            </p>
            <p className="text-[12px] text-dp-text-tertiary mt-2">{order.shipping_email}</p>
            {order.shipping_phone && <p className="text-[12px] text-dp-text-tertiary">{order.shipping_phone}</p>}
            {order.tracking_code && !hasShipments && (
              <div className="mt-3 pt-3 border-t border-dp-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Tracking</p>
                <p className="text-[13px] font-bold text-dp-accent-cta font-mono">{order.tracking_code}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status History */}
      {order.status_history.length > 0 && (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-dp-border">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Status History</h2>
          </div>
          <ul className="divide-y divide-dp-border">
            {[...order.status_history].reverse().map((entry) => {
              const entryCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.pending
              return (
                <li key={entry.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-widest ${entryCfg.color} ${entryCfg.bg}`}>
                      <entryCfg.Icon size={10} /> {entryCfg.label}
                    </span>
                    {entry.note && <span className="text-[12px] text-dp-text-tertiary">{entry.note}</span>}
                  </div>
                  <div className="text-[11px] text-dp-text-tertiary text-right">
                    {entry.changed_by_email && <span>{entry.changed_by_email} · </span>}
                    {new Date(entry.changed_at).toLocaleString()}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
