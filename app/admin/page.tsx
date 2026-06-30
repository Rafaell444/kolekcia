"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import {
  TrendingUp, ShoppingCart, Users, DollarSign, Package,
  ArrowUpRight, Zap,
} from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import { getAdminUser } from "@/lib/admin-auth"

type DashStats = {
  total_revenue: string
  total_orders: number
  total_products: number
  orders_last_30d: number
  unique_customers?: number
  new_users_last_30d?: number
  active_auctions?: number
  active_since?: string | null
}

function StatCard({
  label, value, sub, Icon, accent,
}: {
  label: string; value: string; sub?: string
  Icon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>
  accent: string
}): React.ReactElement {
  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 flex flex-col gap-3">
      <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: `${accent}18` }} aria-hidden>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        <p className="font-display text-3xl text-dp-text-primary leading-none">{value}</p>
        <p className="text-[12px] text-dp-text-tertiary mt-1 uppercase tracking-widest">{label}</p>
        {sub && <p className="text-[11px] text-dp-success mt-0.5 flex items-center gap-0.5"><ArrowUpRight size={11} />{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboard(): React.ReactElement {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)
  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = adminUser && !adminUser.is_staff && !!adminUser.vendor

  useEffect(() => {
    let cancelled = false
    const endpoint = isVendor ? "/vendors/me/dashboard/" : "/admin/dashboard/"
    adminFetch<DashStats>(endpoint)
      .then((d) => { if (!cancelled) setStats(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isVendor])

  const title = isVendor ? adminUser?.vendor?.name ?? "My Store" : "Platform Overview"

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">{title}</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">
          {isVendor ? "Your store's performance at a glance." : "All vendors' data combined."}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1,2,3,4].map((i) => <div key={i} className="h-32 bg-dp-bg-elevated rounded-sm" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={`$${parseFloat(stats.total_revenue).toLocaleString("en", { minimumFractionDigits: 2 })}`} Icon={DollarSign} accent="#e63946" sub={`${stats.orders_last_30d} orders this month`} />
          <StatCard label="Total Orders" value={stats.total_orders.toLocaleString()} Icon={ShoppingCart} accent="#00b4d8" />
          <StatCard label="Products" value={stats.total_products.toLocaleString()} Icon={Package} accent="#e8a427" />
          <StatCard label={isVendor ? "Unique Customers" : "Total Users"} value={(isVendor ? stats.unique_customers : stats.new_users_last_30d)?.toLocaleString() ?? "—"} Icon={Users} accent="#2d6a4f" />
        </div>
      ) : (
        <p className="text-dp-text-tertiary">Could not load stats.</p>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { href: "/admin/products", label: "Manage Products", Icon: Package },
            { href: "/admin/orders", label: "View Orders", Icon: ShoppingCart },
            { href: "/admin/blog", label: "Manage Blog", Icon: TrendingUp },
            { href: "/admin/users", label: isVendor ? "Customers" : "All Users", Icon: Users },
            { href: "/admin/analytics", label: "Analytics", Icon: TrendingUp },
          ].map(({ href, label, Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 p-4 bg-dp-bg-surface border border-dp-border rounded-sm hover:border-dp-border-hover hover:bg-dp-bg-elevated transition-colors">
              <Icon size={16} className="text-dp-accent-cta shrink-0" />
              <span className="text-[13px] font-medium text-dp-text-primary">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {!isVendor && (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3 flex items-center gap-2">
            <Zap size={12} className="text-dp-accent-cta" /> Superadmin — Vendor Overview
          </h2>
          <p className="text-[13px] text-dp-text-secondary">
            You are viewing aggregated data for all vendors. Use the{" "}
            <Link href="/admin/vendors" className="text-dp-accent-cta hover:underline">Vendors page</Link>{" "}
            to manage individual vendor accounts.
          </p>
        </div>
      )}
    </div>
  )
}
