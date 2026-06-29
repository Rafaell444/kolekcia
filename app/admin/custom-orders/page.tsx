"use client"

import React, { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { getAdminUser } from "@/lib/admin-auth"
import {
  Package, Clock, CheckCircle, Truck, XCircle, Eye,
  ChevronDown, Loader2,
} from "lucide-react"

type CustomOrder = {
  id: string
  vendor_name: string | null
  product_type: string
  name: string
  email: string
  phone: string
  image_url: string
  notes: string
  status: string
  payment_ref: string
  created_at: string
}

const STATUS_OPTIONS = [
  { value: "pending",   label: "Pending",    icon: Clock,         color: "text-amber-500" },
  { value: "review",    label: "In Review",  icon: Eye,           color: "text-blue-400" },
  { value: "approved",  label: "Approved",   icon: CheckCircle,   color: "text-green-400" },
  { value: "paid",      label: "Paid",       icon: CheckCircle,   color: "text-emerald-400" },
  { value: "printing",  label: "Printing",   icon: Package,       color: "text-purple-400" },
  { value: "shipped",   label: "Shipped",    icon: Truck,         color: "text-cyan-400" },
  { value: "cancelled", label: "Cancelled",  icon: XCircle,       color: "text-red-400" },
]

function relDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status)
  const Icon = opt?.icon ?? Clock
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${opt?.color ?? "text-dp-text-tertiary"}`}>
      <Icon size={12} />
      {opt?.label ?? status}
    </span>
  )
}

function StatusSelect({
  value,
  onChange,
  updating,
}: {
  value: string
  onChange: (v: string) => void
  updating: boolean
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={updating}
        className="appearance-none pl-3 pr-7 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[11px] font-bold uppercase tracking-wider text-dp-text-primary focus:outline-none focus:border-dp-accent-cta cursor-pointer disabled:opacity-50"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {updating ? (
        <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-dp-text-tertiary pointer-events-none" />
      ) : (
        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-dp-text-tertiary pointer-events-none" />
      )}
    </div>
  )
}

// ─── Order detail modal ──────────────────────────────────────

function OrderModal({ order, onClose }: { order: CustomOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border">
          <h3 className="text-[14px] font-bold text-dp-text-primary">Custom Order Detail</h3>
          <button onClick={onClose} className="text-[11px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors">Close ✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {/* Reference */}
          <div>
            <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-1">Reference</p>
            <p className="text-[12px] font-mono text-dp-text-secondary">{order.payment_ref}</p>
          </div>

          {/* Product type */}
          <div>
            <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-1">Product Type</p>
            <p className="text-[13px] font-bold text-dp-text-primary">{order.product_type}</p>
          </div>

          {/* Customer */}
          <div>
            <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-1">Customer</p>
            <p className="text-[13px] text-dp-text-primary">{order.name}</p>
            <p className="text-[12px] text-dp-text-secondary">{order.email}</p>
            {order.phone && <p className="text-[12px] text-dp-text-secondary">{order.phone}</p>}
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-1">Notes</p>
              <p className="text-[12px] text-dp-text-secondary leading-relaxed">{order.notes}</p>
            </div>
          )}

          {/* Image */}
          <div>
            <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-2">Uploaded Image</p>
            {order.image_url && order.image_url.startsWith("data:") ? (
              <img src={order.image_url} alt="Customer design" className="max-h-64 rounded-sm object-contain border border-dp-border" />
            ) : (
              <p className="text-[11px] text-dp-text-tertiary italic">Image stored externally</p>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-1">Status</p>
            <StatusBadge status={order.status} />
          </div>

          <p className="text-[10px] text-dp-text-tertiary">Submitted: {relDate(order.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function AdminCustomOrdersPage(): React.ReactElement {
  const [orders, setOrders] = useState<CustomOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [viewOrder, setViewOrder] = useState<CustomOrder | null>(null)

  const adminUser = getAdminUser()
  const isVendor = !!adminUser?.vendor

  useEffect(() => {
    let cancelled = false
    adminFetch<CustomOrder[]>("/vendors/me/custom-orders/")
      .then((d) => { if (!cancelled) setOrders(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      const updated = await adminFetch<CustomOrder>(`/vendors/me/custom-orders/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      setOrders((prev) => prev.map((o) => o.id === id ? updated : o))
    } catch { /* noop */ }
    finally { setUpdatingId(null) }
  }

  const statusCounts = STATUS_OPTIONS.map((o) => ({
    ...o,
    count: orders.filter((order) => order.status === o.value).length,
  })).filter((o) => o.count > 0)

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-8 py-5 border-b border-dp-border bg-dp-bg-surface shrink-0 flex items-center gap-4">
        <Package size={20} className="text-dp-accent-cta" />
        <div>
          <h1 className="font-display text-3xl text-dp-text-primary">Custom Orders</h1>
          <p className="text-[11px] text-dp-text-tertiary mt-0.5">
            {isVendor ? "Custom orders for your product type" : "All custom orders across vendors"}
          </p>
        </div>
        <span className="ml-auto px-3 py-1 rounded-full bg-dp-bg-elevated border border-dp-border text-[11px] font-bold text-dp-text-secondary">
          {orders.length} total
        </span>
      </div>

      {/* Status summary chips */}
      {statusCounts.length > 0 && (
        <div className="px-8 py-4 border-b border-dp-border flex flex-wrap gap-3">
          {statusCounts.map(({ value, label, icon: Icon, color, count }) => (
            <div key={value} className="flex items-center gap-1.5 px-3 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm">
              <Icon size={12} className={color} />
              <span className="text-[11px] text-dp-text-secondary font-medium">{label}</span>
              <span className="text-[11px] font-bold text-dp-text-primary ml-1">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-dp-bg-elevated rounded-sm" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-dp-text-tertiary">
            <Package size={40} className="opacity-20" />
            <p className="text-[14px] font-medium">No custom orders yet</p>
            <p className="text-[12px]">When customers submit a custom order, it will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-dp-border text-dp-text-tertiary">
                {["Date", "Customer", "Product Type", !isVendor && "Vendor", "Notes", "Status", "Action"].filter(Boolean).map((h) => (
                  <th key={String(h)} className="text-left py-2 pr-4 font-bold uppercase tracking-widest text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-dp-border hover:bg-dp-bg-elevated transition-colors">
                  <td className="py-3 pr-4 text-dp-text-tertiary whitespace-nowrap">{relDate(o.created_at)}</td>
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-dp-text-primary truncate max-w-[120px]">{o.name}</p>
                    <p className="text-dp-text-tertiary truncate max-w-[120px]">{o.email}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="px-2 py-0.5 rounded-sm bg-dp-bg-elevated border border-dp-border text-dp-text-secondary font-medium">
                      {o.product_type || "—"}
                    </span>
                  </td>
                  {!isVendor && (
                    <td className="py-3 pr-4 text-dp-text-secondary">{o.vendor_name ?? "—"}</td>
                  )}
                  <td className="py-3 pr-4 max-w-[160px]">
                    <p className="truncate text-dp-text-secondary">{o.notes || <span className="text-dp-text-tertiary italic">—</span>}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-3 flex items-center gap-2">
                    <button
                      onClick={() => setViewOrder(o)}
                      className="text-[11px] text-dp-text-tertiary hover:text-dp-accent-cta transition-colors flex items-center gap-1"
                    >
                      <Eye size={12} /> View
                    </button>
                    <StatusSelect
                      value={o.status}
                      onChange={(v) => updateStatus(o.id, v)}
                      updating={updatingId === o.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewOrder && <OrderModal order={viewOrder} onClose={() => setViewOrder(null)} />}
    </div>
  )
}
