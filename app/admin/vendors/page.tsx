"use client"

import React, { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { Store, DollarSign, Package, Users, TrendingUp, Pencil, X } from "lucide-react"
import { VendorStorefrontForm } from "@/app/admin/settings/VendorStorefrontForm"

type Vendor = {
  id: number; name: string; slug: string; logo_url: string
  owner_email: string; owner_name: string; payment_email: string
  description: string; created_at: string
}

type VendorStats = {
  total_revenue: string; total_orders: number; total_products: number; unique_customers: number
}

function VendorCard({ vendor, onEdit }: { vendor: Vendor; onEdit: () => void }) {
  const [stats, setStats] = useState<VendorStats | null>(null)

  useEffect(() => {
    adminFetch<VendorStats>(`/vendors/me/dashboard/?vendor=${vendor.slug}`)
      .then(setStats).catch(() => {})
  }, [vendor.slug])

  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="p-5 border-b border-dp-border flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-sm bg-dp-accent-cta/10 border border-dp-accent-cta/30 flex items-center justify-center shrink-0">
          <Store size={18} className="text-dp-accent-cta" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg text-dp-text-primary truncate">{vendor.name}</p>
          <p className="text-[11px] text-dp-text-tertiary">@{vendor.slug} · {vendor.owner_email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm border border-dp-accent-cta/30 text-dp-accent-cta bg-dp-accent-cta/5">
            Vendor
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 text-[11px] font-semibold text-dp-text-secondary hover:text-dp-accent-cta transition-colors"
          >
            <Pencil size={12} /> Edit storefront
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-dp-border">
        {[
          { label: "Revenue", value: stats ? `$${parseFloat(stats.total_revenue).toFixed(2)}` : "—", Icon: DollarSign },
          { label: "Orders",  value: stats?.total_orders?.toLocaleString() ?? "—", Icon: TrendingUp },
          { label: "Products",value: stats?.total_products?.toLocaleString() ?? "—", Icon: Package },
          { label: "Customers",value: stats?.unique_customers?.toLocaleString() ?? "—", Icon: Users },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="p-4 flex flex-col gap-1">
            <Icon size={13} className="text-dp-text-tertiary" aria-hidden />
            <p className="font-display text-2xl text-dp-text-primary leading-none">{value}</p>
            <p className="text-[10px] uppercase tracking-widest text-dp-text-tertiary">{label}</p>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 flex items-center justify-between text-[11px] text-dp-text-tertiary bg-dp-bg-elevated">
        <span>Payment: <strong className="text-dp-text-secondary">{vendor.payment_email || "not set"}</strong></span>
        <span>Since {new Date(vendor.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

export default function AdminVendorsPage(): React.ReactElement {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)

  useEffect(() => {
    adminFetch<Vendor[]>("/vendors/me/")
      .then((d) => setVendors(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Vendors</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Manage vendor accounts and view their individual performance.</p>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1,2].map((i) => <div key={i} className="h-48 bg-dp-bg-elevated rounded-sm" />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-dp-text-tertiary">
          <Store size={40} className="opacity-30" />
          <p>No vendors yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {vendors.map((v) => <VendorCard key={v.id} vendor={v} onEdit={() => setEditingSlug(v.slug)} />)}
        </div>
      )}

      {editingSlug && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="w-full max-w-2xl bg-dp-bg-surface border border-dp-border rounded-sm shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border">
              <h2 className="font-display text-2xl text-dp-text-primary">Edit storefront — @{editingSlug}</h2>
              <button onClick={() => setEditingSlug(null)} className="text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <VendorStorefrontForm vendorSlug={editingSlug} allowCategory onSaved={() => setEditingSlug(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
