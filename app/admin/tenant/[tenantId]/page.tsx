"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  DollarSign, ShoppingCart, Package, CreditCard,
  ArrowUpRight, TrendingUp, Clock, CheckCircle, Truck,
} from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type TenantOrder = { id: string; order_number: string; status: string; total: string; created_at: string }
type TenantProduct = { id: string; title: string; base_price: string }
type TenantRevenue = { total_revenue: string; order_count: number }

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-400", processing: "bg-blue-400",
  shipped: "bg-orange-400", delivered: "bg-green-500", cancelled: "bg-gray-400",
}

function StatCard({ label, value, sub, Icon, accent }: {
  label: string; value: string; sub?: string
  Icon: React.FC<{ size?: number; className?: string }>; accent: string
}) {
  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 flex flex-col gap-3">
      <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: `${accent}18` }} aria-hidden>
        <Icon size={18} className="" />
      </div>
      <div>
        <p className="font-display text-3xl text-dp-text-primary leading-none">{value}</p>
        <p className="text-[11px] text-dp-text-tertiary mt-1 uppercase tracking-widest">{label}</p>
        {sub && <p className="text-[11px] text-dp-text-tertiary mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function TenantDashboard(): React.ReactElement {
  const params = useParams<{ tenantId: string }>()
  const tenantId = params.tenantId

  const [orders, setOrders] = useState<TenantOrder[]>([])
  const [products, setProducts] = useState<TenantProduct[]>([])
  const [revenue, setRevenue] = useState<TenantRevenue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    Promise.all([
      adminFetch<TenantOrder[]>(`/tenants/${tenantId}/orders/`).catch(() => []),
      adminFetch<TenantProduct[]>(`/tenants/${tenantId}/products/`).catch(() => []),
      adminFetch<TenantRevenue>(`/tenants/${tenantId}/revenue/`).catch(() => null),
    ]).then(([o, p, r]) => {
      if (cancelled) return
      setOrders(o)
      setProducts(p)
      setRevenue(r)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tenantId])

  const base = `/admin/tenant/${tenantId}`
  const pendingOrders   = orders.filter((o) => o.status === "pending").length
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length

  return (
    <div className="p-8 flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 bg-dp-accent-cta/10 text-dp-accent-cta">
            Vendor Portal
          </div>
          <h1 className="font-display text-4xl text-dp-text-primary capitalize">{tenantId}</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Your private vendor dashboard — only your data is shown here.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">{[1,2,3,4].map((i) => <div key={i} className="h-28 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Net Revenue"  value={`$${parseFloat(revenue?.total_revenue ?? "0").toFixed(0)}`} sub="after fees"           Icon={DollarSign}  accent="#2dc653" />
          <StatCard label="Total Orders" value={String(orders.length)}                                       sub={`${pendingOrders} pending`} Icon={ShoppingCart} accent="#e63946" />
          <StatCard label="Products"     value={String(products.length)}                                     sub="in catalogue"         Icon={Package}     accent="#06b6d4" />
          <StatCard label="Delivered"    value={String(deliveredOrders)}                                     sub="completed orders"     Icon={CreditCard}  accent="#2dc653" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
            <h2 className="font-display text-xl text-dp-text-primary">Recent Orders</h2>
            <Link href={`${base}/orders`} className="text-[11px] font-semibold uppercase tracking-widest text-dp-text-tertiary hover:text-dp-text-primary transition-colors flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-dp-border">
            {orders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[o.status] ?? "bg-gray-400"}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-dp-text-primary truncate">{o.order_number}</p>
                  <p className="text-[11px] text-dp-text-tertiary truncate">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-[13px] font-bold text-dp-text-primary shrink-0">${parseFloat(o.total).toFixed(2)}</span>
                <span className="text-[10px] capitalize text-dp-text-tertiary hidden sm:block">{o.status}</span>
              </div>
            ))}
            {orders.length === 0 && !loading && <p className="text-center py-6 text-dp-text-tertiary text-[13px]">No orders yet.</p>}
          </div>
        </section>

        <section className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
            <h2 className="font-display text-xl text-dp-text-primary">Products</h2>
            <Link href={`${base}/products`} className="text-[11px] font-semibold uppercase tracking-widest text-dp-text-tertiary hover:text-dp-text-primary transition-colors flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-dp-border">
            {products.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-dp-text-primary truncate">{p.title}</p>
                </div>
                <span className="text-[13px] font-bold text-dp-text-primary shrink-0">${parseFloat(p.base_price).toFixed(2)}</span>
              </div>
            ))}
            {products.length === 0 && !loading && <p className="text-center py-6 text-dp-text-tertiary text-[13px]">No products yet.</p>}
          </div>
        </section>
      </div>

      <section>
        <h2 className="font-display text-2xl text-dp-text-primary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "All Orders", href: `${base}/orders`, Icon: ShoppingCart },
            { label: "Products",   href: `${base}/products`, Icon: Package },
            { label: "Analytics",  href: base, Icon: TrendingUp },
          ].map(({ label, href, Icon }) => (
            <Link key={label} href={href} className="flex flex-col items-center gap-2 p-5 bg-dp-bg-surface border border-dp-border rounded-sm hover:border-dp-border-hover hover:bg-dp-bg-elevated transition-colors text-center">
              <Icon size={20} className="text-dp-accent-cta" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-dp-text-secondary">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
