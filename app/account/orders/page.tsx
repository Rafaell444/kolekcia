"use client"

import React, { useEffect, useState } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Link from "next/link"
import { Package, ArrowRight } from "lucide-react"
import { authFetch } from "@/lib/api"

type OrderItem = { id: number; product_title: string; quantity: number }
type Order = {
  id: string
  order_number: string
  status: string
  total: string
  created_at: string
  items: OrderItem[]
  tracking_code: string
}

const STATUS_COLORS: Record<string, string> = {
  delivered:  "text-dp-success bg-dp-success/10 border-dp-success/30",
  shipped:    "text-dp-accent-cta bg-dp-accent-cta/10 border-dp-accent-cta/30",
  processing: "text-dp-accent-gold bg-dp-accent-gold/10 border-dp-accent-gold/30",
  pending:    "text-dp-text-tertiary bg-dp-bg-elevated border-dp-border",
  cancelled:  "text-dp-accent-cta/70 bg-dp-accent-cta/5 border-dp-accent-cta/20",
}

export default function OrdersPage(): React.ReactElement {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authFetch<{ results: Order[] }>("/orders/")
      .then((data) => { if (!cancelled) setOrders(data.results) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <h1 className="font-display text-4xl text-dp-text-primary mb-8">Order History</h1>
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-dp-bg-elevated rounded-sm" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24">
            <Package size={40} className="text-dp-text-tertiary" />
            <p className="text-dp-text-secondary">No orders yet.</p>
            <Link href="/catalog" className="px-6 py-3 bg-dp-accent-cta text-white text-[12px] font-black uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors">
              Shop Now
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-dp-text-primary text-[14px]">{order.order_number}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm ${STATUS_COLORS[order.status] ?? STATUS_COLORS["pending"]}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-dp-text-tertiary">
                    {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    {" · "}{order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </p>
                  {order.tracking_code && (
                    <p className="text-[11px] text-dp-text-tertiary mt-1">Tracking: <strong>{order.tracking_code}</strong></p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-bold text-[16px] text-dp-text-primary">${parseFloat(order.total).toFixed(2)}</span>
                  <Link href={`/account/orders/${order.id}`} className="flex items-center gap-1 text-[12px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors">
                    Details <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
