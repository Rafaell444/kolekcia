"use client"

import React, { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { Store, DollarSign, Package, Users, TrendingUp, Pencil, X, Tag } from "lucide-react"
import { VendorStorefrontForm } from "@/app/admin/settings/VendorStorefrontForm"

type Vendor = {
  id: number; name: string; slug: string; logo_url: string
  owner_email: string; owner_name: string; payment_email: string
  description: string; created_at: string
}

type VendorStats = {
  total_revenue: string; total_orders: number; total_products: number; unique_customers: number
}

function VendorSaleModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const [discountPct, setDiscountPct] = useState("")
  const [currency, setCurrency] = useState<"GEL" | "USD" | "both">("both")
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState("")

  const INPUT_CLS = "w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
  const LABEL_CLS = "block text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1"

  async function handleApply() {
    setError("")
    const pct = parseFloat(discountPct)
    if (isNaN(pct) || pct <= 0 || pct >= 100) { setError("Enter a discount between 1 and 99."); return }
    setSaving(true)
    try {
      const res = await adminFetch<{ detail?: string; variants_updated?: number }>(
        `/admin/vendors/${vendor.slug}/sale/`,
        { method: "POST", body: JSON.stringify({ discount_pct: pct, currency }) }
      )
      setResult(res.detail ?? `Sale applied to ${res.variants_updated} variants.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply sale.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    setError("")
    try {
      await adminFetch(`/admin/vendors/${vendor.slug}/sale/`, { method: "DELETE" })
      setResult("Sale removed from all products.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove sale.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto py-8 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md mx-auto bg-dp-bg-surface border border-dp-border rounded-sm shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border">
          <h2 className="font-display text-xl text-dp-text-primary">Run Sale — {vendor.name}</h2>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {result ? (
            <div className="text-center py-6">
              <p className="text-dp-accent-cta font-semibold text-[14px]">{result}</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className={LABEL_CLS}>Discount %</label>
                <input
                  type="number" min={1} max={99} step={1}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="e.g. 20"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Apply to currency</label>
                <div className="flex gap-2">
                  {(["both", "GEL", "USD"] as const).map((c) => (
                    <button key={c} type="button"
                      onClick={() => setCurrency(c)}
                      className={`flex-1 px-3 py-2 border rounded-sm text-[11px] font-bold uppercase tracking-widest transition-colors ${
                        currency === c ? "border-dp-accent-cta bg-dp-accent-cta/10 text-dp-accent-cta" : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"
                      }`}>
                      {c === "both" ? "Both (GEL + USD)" : c === "GEL" ? "Georgian ₾" : "Other $"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-dp-text-tertiary">
                This will set sale prices on all active size variants for <strong className="text-dp-text-secondary">{vendor.name}</strong> and mark all products as on sale.
              </p>
              {error && <p className="text-[12px] text-red-400">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => void handleApply()} disabled={saving}
                  className="flex-1 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors">
                  {saving ? "Applying…" : "Apply Sale"}
                </button>
                <button onClick={() => void handleRemove()} disabled={saving}
                  className="px-5 py-2.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-60 text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors">
                  Remove Sale
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function VendorCard({ vendor, onEdit, onSale }: { vendor: Vendor; onEdit: () => void; onSale: () => void }) {
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
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
          <button
            type="button"
            onClick={onSale}
            className="flex items-center gap-1 text-[11px] font-semibold text-dp-text-secondary hover:text-red-400 transition-colors"
          >
            <Tag size={12} /> Run Sale
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
  const [saleVendor, setSaleVendor] = useState<Vendor | null>(null)

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
          {vendors.map((v) => <VendorCard key={v.id} vendor={v} onEdit={() => setEditingSlug(v.slug)} onSale={() => setSaleVendor(v)} />)}
        </div>
      )}

      {saleVendor && (
        <VendorSaleModal vendor={saleVendor} onClose={() => setSaleVendor(null)} />
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
