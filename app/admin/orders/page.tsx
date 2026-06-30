"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Truck, CheckCircle, Clock, Package, XCircle, Search, Eye } from "lucide-react"

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"
type AdminOrder = {
  id: string; order_number: string; status: OrderStatus
  shipping_name: string; shipping_email: string
  total: string; created_at: string; tracking_code: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.FC<{ size?: number }> }> = {
  pending:    { label: "Pending",    color: "text-dp-accent-gold",  bg: "bg-dp-accent-gold/10 border-dp-accent-gold/30",  Icon: Clock       },
  processing: { label: "Processing", color: "text-blue-400",        bg: "bg-blue-400/10 border-blue-400/30",              Icon: Package     },
  shipped:    { label: "Shipped",    color: "text-dp-accent-cta",   bg: "bg-dp-accent-cta/10 border-dp-accent-cta/30",    Icon: Truck       },
  delivered:  { label: "Delivered",  color: "text-dp-success",      bg: "bg-dp-success/10 border-dp-success/30",          Icon: CheckCircle },
  cancelled:  { label: "Cancelled",  color: "text-dp-text-tertiary",bg: "bg-dp-bg-elevated border-dp-border",             Icon: XCircle     },
}

export default function AdminOrdersPage(): React.ReactElement {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [updating, setUpdating] = useState<string | null>(null)

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

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdating(orderId)
    try {
      const updated = await adminFetch<AdminOrder>(`/admin/orders/${orderId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: updated.status } : o))
    } catch { /* noop */ }
    finally { setUpdating(null) }
  }

  const filtered = orders.filter((o) => {
    const matchSearch = !search
      || o.order_number.toLowerCase().includes(search.toLowerCase())
      || o.shipping_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || o.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">Orders</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">
          {isVendor ? "Orders containing your products." : "All orders across the platform."}
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…"
            className="pl-8 pr-4 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors">
          <option value="all">All statuses</option>
          {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-dp-border">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Actions</th>
                {!isVendor && <th className="text-left px-4 py-3">Update</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-dp-border">
              {filtered.map((o) => {
                const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending
                return (
                  <tr key={o.id} className="hover:bg-dp-bg-elevated transition-colors">
                    <td className="px-4 py-3 font-semibold text-dp-text-primary">{o.order_number}</td>
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
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-dp-accent-cta hover:underline"
                      >
                        <Eye size={12} /> View details
                      </Link>
                    </td>
                    {!isVendor && (
                      <td className="px-4 py-3">
                        <select value={o.status} disabled={updating === o.id}
                          onChange={(e) => updateStatus(o.id, e.target.value)}
                          className="px-2 py-1 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary focus:outline-none disabled:opacity-50 cursor-pointer">
                          {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                        </select>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No orders found.</p>}
        </div>
      )}
    </div>
  )
}
