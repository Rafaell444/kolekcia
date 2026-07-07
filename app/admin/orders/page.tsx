"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Truck, CheckCircle, Clock, Package, XCircle, Search, Eye, X } from "lucide-react"

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"
type OrderItem = { id: number; processing_option: string }
type AdminOrder = {
  id: string; order_number: string; status: OrderStatus
  shipping_name: string; shipping_email: string
  total: string; created_at: string; tracking_code: string
  items?: OrderItem[]
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

function getShipByDate(order: AdminOrder): Date | null {
  const items = order.items
  if (!items || items.length === 0) return null
  const DAYS: Record<string, number> = { standard: 10, fast: 7, express: 5 }
  const maxDays = items.reduce((max, item) => {
    const days = item.processing_option ? (DAYS[item.processing_option] ?? 10) : 25
    return Math.max(max, days)
  }, 0)
  return addBusinessDays(new Date(order.created_at), maxDays)
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.FC<{ size?: number }> }> = {
  pending:    { label: "Pending",    color: "text-dp-accent-gold",  bg: "bg-dp-accent-gold/10 border-dp-accent-gold/30",  Icon: Clock       },
  processing: { label: "Processing", color: "text-blue-400",        bg: "bg-blue-400/10 border-blue-400/30",              Icon: Package     },
  shipped:    { label: "Shipped",    color: "text-dp-accent-cta",   bg: "bg-dp-accent-cta/10 border-dp-accent-cta/30",    Icon: Truck       },
  delivered:  { label: "Delivered",  color: "text-dp-success",      bg: "bg-dp-success/10 border-dp-success/30",          Icon: CheckCircle },
  cancelled:  { label: "Cancelled",  color: "text-dp-text-tertiary",bg: "bg-dp-bg-elevated border-dp-border",             Icon: XCircle     },
}

function ShipModal({
  order,
  onConfirm,
  onClose,
}: {
  order: AdminOrder
  onConfirm: (trackingCode: string) => Promise<void>
  onClose: () => void
}) {
  const [tracking, setTracking] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onConfirm(tracking)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm bg-dp-bg-surface border border-dp-border rounded-sm shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-dp-accent-cta" />
            <h2 className="font-display text-lg text-dp-text-primary">Mark as Shipped</h2>
          </div>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          <p className="text-[13px] text-dp-text-secondary">
            Order <strong className="text-dp-text-primary">{order.order_number}</strong> for{" "}
            <strong className="text-dp-text-primary">{order.shipping_name}</strong> will be marked as shipped
            and the customer will receive a confirmation email.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">
              Tracking Number
            </label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. GE123456789GE"
              className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
            />
            <p className="text-[11px] text-dp-text-tertiary">Optional — included in the shipping email to the customer.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-dp-border rounded-sm text-[12px] font-semibold text-dp-text-secondary hover:bg-dp-bg-elevated transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50">
              <Truck size={13} /> {saving ? "Shipping…" : "Confirm Shipped"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminOrdersPage(): React.ReactElement {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [updating, setUpdating] = useState<string | null>(null)
  const [shipTarget, setShipTarget] = useState<AdminOrder | null>(null)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = adminUser && !adminUser.is_staff && !!adminUser.vendor
  const listEndpoint = isVendor ? "/vendors/me/orders/" : "/admin/orders/"

  useEffect(() => {
    let cancelled = false
    adminFetch<AdminOrder[]>(listEndpoint)
      .then((d) => { if (!cancelled) setOrders(Array.isArray(d) ? d : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [listEndpoint])

  async function updateStatus(orderId: string, newStatus: string, trackingCode?: string) {
    setUpdating(orderId)
    try {
      const body: Record<string, string> = { status: newStatus }
      if (trackingCode !== undefined) body.tracking_code = trackingCode
      const updated = await adminFetch<AdminOrder>(`/admin/orders/${orderId}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: updated.status, tracking_code: updated.tracking_code } : o))
    } catch { /* noop */ }
    finally { setUpdating(null) }
  }

  function handleStatusChange(order: AdminOrder, newStatus: string) {
    if (newStatus === "shipped") {
      setShipTarget(order)
    } else {
      void updateStatus(order.id, newStatus)
    }
  }

  async function handleShipConfirm(trackingCode: string) {
    if (!shipTarget) return
    await updateStatus(shipTarget.id, "shipped", trackingCode)
    setShipTarget(null)
  }

  const filtered = orders.filter((o) => {
    const matchSearch = !search
      || o.order_number.toLowerCase().includes(search.toLowerCase())
      || o.shipping_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || o.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <>
      {shipTarget && (
        <ShipModal
          order={shipTarget}
          onConfirm={handleShipConfirm}
          onClose={() => setShipTarget(null)}
        />
      )}

      <div className="p-4 sm:p-8 flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Orders</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">
            {isVendor ? "Orders containing your products." : "All orders across the platform."}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0 sm:flex-none">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…"
              className="w-full sm:w-auto pl-8 pr-4 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors">
            <option value="all">All statuses</option>
            {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : (
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead className="border-b border-dp-border">
                <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                  <th className="text-left px-4 py-3">Order</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Ordered</th>
                  <th className="text-left px-4 py-3">Ship by</th>
                  <th className="text-left px-4 py-3">Details</th>
                  <th className="text-left px-4 py-3">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dp-border">
                {filtered.map((o) => {
                  const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending
                  return (
                    <tr key={o.id} className="hover:bg-dp-bg-elevated transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-dp-text-primary">{o.order_number}</p>
                        {o.tracking_code && (
                          <p className="text-[11px] text-dp-text-tertiary mt-0.5">📦 {o.tracking_code}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-dp-text-secondary">
                        {o.shipping_name}<br />
                        <span className="text-[11px] text-dp-text-tertiary">{o.shipping_email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-widest ${cfg.color} ${cfg.bg}`}>
                          <cfg.Icon size={10} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">${parseFloat(o.total).toFixed(2)}</td>
                      <td className="px-4 py-3 text-dp-text-tertiary">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const shipBy = getShipByDate(o)
                          if (!shipBy) return <span className="text-dp-text-tertiary">—</span>
                          const daysLeft = Math.ceil((shipBy.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          const overdue = daysLeft < 0
                          const soon = !overdue && daysLeft <= 3
                          return (
                            <div>
                              <p className="text-[12px] font-semibold text-dp-text-primary">
                                {shipBy.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                              <p className={`text-[10px] font-bold ${overdue ? "text-red-400" : soon ? "text-amber-400" : "text-dp-text-tertiary"}`}>
                                {overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                              </p>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-dp-accent-cta hover:underline"
                        >
                          <Eye size={12} /> View
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          disabled={updating === o.id}
                          onChange={(e) => handleStatusChange(o, e.target.value)}
                          className="px-2 py-1 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary focus:outline-none disabled:opacity-50 cursor-pointer"
                        >
                          {Object.keys(STATUS_CONFIG).map((s) => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No orders found.</p>}
          </div>
        )}
      </div>
    </>
  )
}
