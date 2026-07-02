"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { Plus, Search, Pencil, Trash2, X, DollarSign, Package, ImageIcon } from "lucide-react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"

type AdminProduct = {
  id: number; title: string; artist_name: string; base_price: string
  regional_prices?: Record<string, { price?: string; original?: string | null }>
  image_url?: string
  images: { url: string }[]; is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean
  category_slug: string
  status?: "active" | "paused" | "sold"
  vendor_slug?: string | null
  vendor_name?: string | null
}

type ProductDraft = {
  title: string; imageUrl: string; price: string; originalPrice: string
  priceGel: string; priceEur: string; priceGbp: string
  category: string; tags: string
  vendorSlug: string
  status: "active" | "paused" | "sold"
  isLimited: boolean; isSale: boolean; isNew: boolean; isExclusive: boolean
}

type VendorOption = { id: number; name: string; slug: string }

type ProductStatus = "active" | "paused" | "sold"

const STATUS_STYLE: Record<ProductStatus, { dot: string; text: string; border: string; bg: string }> = {
  active: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
  },
  paused: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
  },
  sold: {
    dot: "bg-dp-text-tertiary",
    text: "text-dp-text-secondary",
    border: "border-dp-border-hover",
    bg: "bg-dp-bg-elevated",
  },
}

function StatusBadge({ status }: { status?: ProductStatus }) {
  const key = status ?? "active"
  const s = STATUS_STYLE[key]

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 border-l-[3px] ${s.border} ${s.bg}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
      <span className={`text-[10px] font-semibold tracking-wide capitalize ${s.text} ${key === "sold" ? "line-through decoration-dp-text-tertiary" : ""}`}>
        {key}
      </span>
    </div>
  )
}

const BLANK_DRAFT: ProductDraft = {
  title: "", imageUrl: "", price: "", originalPrice: "", priceGel: "", priceEur: "", priceGbp: "",
  category: "", tags: "", vendorSlug: "",
  status: "active",
  isLimited: false, isSale: false, isNew: true, isExclusive: false,
}

function ProductModal({
  onClose,
  onSaved,
  editProduct,
  endpoint,
  isVendor,
  vendors,
}: {
  onClose: () => void
  onSaved: (p: AdminProduct) => void
  editProduct?: AdminProduct | null
  endpoint: string
  isVendor: boolean
  vendors: VendorOption[]
}) {
  const [draft, setDraft] = useState<ProductDraft>(
    editProduct
      ? {
          title: editProduct.title,
          imageUrl: editProduct.images?.[0]?.url ?? editProduct.image_url ?? "",
          price: editProduct.base_price,
          originalPrice: "",
          priceGel: editProduct.regional_prices?.GEL?.price?.toString() ?? "",
          priceEur: editProduct.regional_prices?.EUR?.price?.toString() ?? "",
          priceGbp: editProduct.regional_prices?.GBP?.price?.toString() ?? "",
          category: editProduct.category_slug ?? "",
          tags: "",
          vendorSlug: editProduct.vendor_slug ?? "",
          status: editProduct.status ?? "active",
          isLimited: editProduct.is_limited,
          isSale: editProduct.is_sale,
          isNew: editProduct.is_new,
          isExclusive: editProduct.is_exclusive,
        }
      : BLANK_DRAFT
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function set<K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  async function handleSave() {
    if (!draft.title || !draft.price) { setError("Title and price are required."); return }
    setSaving(true)
    setError("")
    try {
      const regional_prices: Record<string, { price: string }> = {}
      if (draft.price) regional_prices.USD = { price: draft.price }
      if (draft.priceGel) regional_prices.GEL = { price: draft.priceGel }
      if (draft.priceEur) regional_prices.EUR = { price: draft.priceEur }
      if (draft.priceGbp) regional_prices.GBP = { price: draft.priceGbp }

      const body = {
        title: draft.title,
        image_url: draft.imageUrl,
        base_price: draft.price,
        original_price: draft.originalPrice || null,
        regional_prices,
        category_slug_input: draft.category,
        vendor_slug_input: draft.vendorSlug || undefined,
        status: draft.status,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
        is_limited: draft.isLimited,
        is_sale: draft.isSale,
        is_new: draft.isNew,
        is_exclusive: draft.isExclusive,
      }
      let saved: AdminProduct
      if (editProduct) {
        saved = await adminFetch<AdminProduct>(`${endpoint}${editProduct.id}/`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      } else {
        saved = await adminFetch<AdminProduct>(endpoint, {
          method: "POST",
          body: JSON.stringify(body),
        })
      }
      onSaved(saved)
      onClose()
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string; [key: string]: unknown } }
      const detail = e?.data?.detail
      if (typeof detail === "string" && detail.trim()) {
        setError(detail)
      } else if (e?.data && typeof e.data === "object") {
        const first = Object.values(e.data).find((v) => typeof v === "string" || (Array.isArray(v) && typeof v[0] === "string"))
        if (typeof first === "string") {
          setError(first)
        } else if (Array.isArray(first) && typeof first[0] === "string") {
          setError(first[0])
        } else {
          setError("Save failed.")
        }
      } else {
        const fallback = err instanceof Error && err.message ? err.message : "Save failed."
        setError(fallback)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto py-6 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl bg-dp-bg-surface border border-dp-border rounded-sm shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border">
          <h2 className="font-display text-2xl text-dp-text-primary">{editProduct ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {error && <p className="text-[13px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-sm px-3 py-2">{error}</p>}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Title *</label>
            <input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Neon Dragon"
              className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Image URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ImageIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <input value={draft.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…"
                  className="w-full pl-8 pr-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors" />
              </div>
              {draft.imageUrl && (
                <div className="w-14 h-14 rounded-sm overflow-hidden border border-dp-border shrink-0 relative">
                  <Image src={draft.imageUrl} alt="Preview" fill className="object-cover" sizes="56px" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Base Price (USD) *</label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <input type="number" min={0} step={0.01} value={draft.price} onChange={(e) => set("price", e.target.value)} placeholder="29.99"
                  className="w-full pl-8 pr-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Original Price (USD)</label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <input type="number" min={0} step={0.01} value={draft.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} placeholder="Optional"
                  className="w-full pl-8 pr-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Regional prices (optional overrides)</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "priceGel" as const, label: "GEL (₾)" },
                { key: "priceEur" as const, label: "EUR (€)" },
                { key: "priceGbp" as const, label: "GBP (£)" },
              ].map(({ key, label }) => (
                <input key={key} type="number" min={0} step={0.01} value={draft[key]} onChange={(e) => set(key, e.target.value)} placeholder={label}
                  className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
              ))}
            </div>
            <p className="text-[11px] text-dp-text-tertiary mt-1.5">Leave blank to auto-convert from USD using exchange rates on the storefront.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Category</label>
              <div className="relative">
                <Package size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <select value={draft.category} onChange={(e) => set("category", e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors appearance-none">
                  <option value="">Select…</option>
                  {["anime","gaming","space","nature","abstract","movies","music","fantasy"].map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Tags (comma-sep)</label>
              <input value={draft.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Anime, Dragon"
                className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
            </div>
          </div>

          {!isVendor && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Assign Vendor</label>
              <select
                value={draft.vendorSlug}
                onChange={(e) => set("vendorSlug", e.target.value)}
                className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
              >
                <option value="">Unassigned</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.slug}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Status</label>
            <select
              value={draft.status}
              onChange={(e) => set("status", e.target.value as ProductDraft["status"])}
              className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="sold">Sold</option>
            </select>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Flags</p>
            <div className="flex flex-wrap gap-4">
              {([
                { key: "isLimited", label: "Limited" },
                { key: "isSale",    label: "On Sale"  },
                { key: "isNew",     label: "New"      },
                { key: "isExclusive", label: "Exclusive" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft[key] as boolean} onChange={() => set(key, !draft[key])} className="w-3.5 h-3.5 accent-dp-accent-cta" />
                  <span className="text-[12px] text-dp-text-secondary">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dp-border bg-dp-bg-elevated">
          <button onClick={onClose} className="px-5 py-2.5 border border-dp-border text-dp-text-secondary text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors hover:border-dp-border-hover">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
            {saving ? "Saving…" : editProduct ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminProductsPage(): React.ReactElement {
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "sold">("all")
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminProduct | null>(null)
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [loading, setLoading] = useState(true)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = adminUser && !adminUser.is_staff && !!adminUser.vendor
  const listEndpoint = isVendor ? "/vendors/me/products/" : "/admin/products/"

  useEffect(() => {
    let cancelled = false
    adminFetch<AdminProduct[]>(listEndpoint)
      .then((d) => { if (!cancelled) setProducts(Array.isArray(d) ? d : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [listEndpoint])

  useEffect(() => {
    if (isVendor) return
    let cancelled = false
    adminFetch<Array<{ id: number; name: string; slug: string }>>("/vendors/me/")
      .then((rows) => { if (!cancelled) setVendors(Array.isArray(rows) ? rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })) : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isVendor])

  async function deleteProduct(id: number) {
    const endpoint = isVendor ? `/vendors/me/products/${id}/` : `/admin/products/${id}/`
    await adminFetch(endpoint, { method: "DELETE" }).catch(() => {})
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  function onSaved(p: AdminProduct) {
    setProducts((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = p; return next
      }
      return [p, ...prev]
    })
  }

  const filtered = products.filter((p) => {
    const textMatch = !q || p.title.toLowerCase().includes(q.toLowerCase()) || (p.artist_name ?? "").toLowerCase().includes(q.toLowerCase())
    const pStatus = p.status ?? "active"
    const statusMatch = statusFilter === "all" ? true : pStatus === statusFilter
    return textMatch && statusMatch
  })

  return (
    <>
      {showModal && (
        <ProductModal
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSaved={onSaved}
          editProduct={editTarget}
          endpoint={listEndpoint}
          isVendor={Boolean(isVendor)}
          vendors={vendors}
        />
      )}

      <div className="p-8 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-dp-text-primary">Products</h1>
            <p className="text-[13px] text-dp-text-tertiary mt-1">
              {isVendor ? "Your product listings." : "All products across all vendors."}
            </p>
          </div>
          <button onClick={() => { setEditTarget(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors shrink-0">
            <Plus size={14} /> Add Product
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72 max-w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
              className="w-full pl-8 pr-4 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
          </div>
          {(["all", "active", "paused", "sold"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 border rounded-sm text-[11px] font-bold uppercase tracking-widest transition-colors ${
                statusFilter === status
                  ? "bg-dp-accent-cta text-white border-dp-accent-cta"
                  : "bg-dp-bg-elevated text-dp-text-secondary border-dp-border hover:border-dp-border-hover"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 animate-pulse">
            {[1,2,3,4,5,6,7].map((i) => <div key={i} className="aspect-[3/4] bg-dp-bg-elevated rounded-sm" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {filtered.map((p) => {
              const thumb = p.images?.[0]?.url ?? p.image_url ?? ""
              return (
                <div key={p.id} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
                  <div className="aspect-[3/4] relative bg-dp-bg-elevated">
                    {thumb && <Image src={thumb} alt={p.title} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button onClick={() => { setEditTarget(p); setShowModal(true) }}
                        className="w-8 h-8 rounded-sm bg-dp-bg-surface flex items-center justify-center text-dp-text-primary hover:bg-dp-bg-elevated transition-colors" aria-label="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteProduct(p.id)}
                        className="w-8 h-8 rounded-sm bg-dp-accent-cta flex items-center justify-center text-white hover:bg-dp-accent-cta-hover transition-colors" aria-label="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                  <div className="p-2.5 pt-2">
                    <p className="text-[9px] text-dp-text-tertiary truncate">{p.artist_name}</p>
                    <p className="text-[12px] font-semibold text-dp-text-primary truncate mt-0.5">{p.title}</p>
                    <div className="mt-1">
                      <span className="text-[12px] font-bold text-dp-text-primary">${parseFloat(p.base_price).toFixed(2)}</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {p.is_limited   && <span className="badge-limited text-[9px]">Limited</span>}
                      {p.is_sale      && <span className="badge-sale text-[9px]">Sale</span>}
                      {p.is_new       && <span className="badge-limited text-[9px]" style={{ background: "var(--dp-success)", color: "#111113" }}>New</span>}
                      {p.is_exclusive && <span className="badge-limited text-[9px]">Exclusive</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && !loading && (
              <p className="col-span-full text-center py-12 text-dp-text-tertiary">
                {q ? "No products match your search." : "No products yet. Click \"Add Product\" to create one."}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
