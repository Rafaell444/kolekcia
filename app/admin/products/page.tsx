"use client"

import React, { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { Plus, Search, Pencil, Trash2, X, DollarSign, Package, ImageIcon, Play, Upload, Download, FileUp, Layers } from "lucide-react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"

type AdminProduct = {
  id: number; title: string; artist_name: string; base_price: string
  regional_prices?: Record<string, { price?: string; original?: string | null }>
  image_url?: string
  images: { id?: number; url: string; src?: string; media_type?: string }[]; is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean
  allow_custom_size?: boolean
  category_slug: string
  category_slugs?: string[]
  status?: "active" | "paused" | "sold"
  vendor_slug?: string | null
  vendor_name?: string | null
  description?: string
  material?: string
  size_variants?: Array<{ id: number; label: string; price_usd: string; sort_order: number; is_active: boolean }>
  variants?: Array<{
    id: number
    size: { id: string; label: string; surcharge: string }
    finish: { id: string; label: string; surcharge: string }
    frame: { id: string; label: string; surcharge: string }
    stock: number
    surcharge: string
    price: string
  }>
}

type ProductDraft = {
  title: string; imageUrl: string; price: string; originalPrice: string
  priceGel: string; priceEur: string; priceGbp: string
  categories: string; tags: string
  vendorSlug: string
  status: "active" | "paused" | "sold"
  isLimited: boolean; isSale: boolean; isNew: boolean; isExclusive: boolean
  allowCustomSize: boolean
  description: string
  material: string
}

type CategoryOption = { id: number; name: string; slug: string }

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
  categories: "", tags: "", vendorSlug: "",
  status: "active",
  isLimited: false, isSale: false, isNew: true, isExclusive: false,
  allowCustomSize: false,
  description: "", material: "",
}

function VariantRow({
  variant,
  basePrice,
  saving,
  onSave,
}: {
  variant: NonNullable<AdminProduct["variants"]>[number]
  basePrice: number
  saving: boolean
  onSave: (surcharge: string) => Promise<void>
}) {
  const [surcharge, setSurcharge] = useState(variant.surcharge)
  const [dirty, setDirty] = useState(false)
  return (
    <tr className="border-b border-dp-border last:border-0">
      <td className="px-3 py-2 text-dp-text-primary">{variant.size.label}</td>
      <td className="px-3 py-2 text-dp-text-secondary">{variant.finish.label}</td>
      <td className="px-3 py-2 text-dp-text-secondary">{variant.frame.label}</td>
      <td className="px-3 py-2">
        <input
          type="number" min={0} step={0.01} value={surcharge}
          onChange={(e) => { setSurcharge(e.target.value); setDirty(true) }}
          className="w-24 px-2 py-1 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary text-right focus:outline-none focus:border-dp-border-hover"
        />
      </td>
      <td className="px-3 py-2 text-right font-semibold text-dp-text-primary">
        ${(basePrice + parseFloat(surcharge || "0")).toFixed(2)}
      </td>
      <td className="px-3 py-2 text-right">
        {dirty && (
          <button
            onClick={() => { void onSave(surcharge).then(() => setDirty(false)) }}
            disabled={saving}
            className="px-2.5 py-1 bg-dp-accent-cta text-white text-[10px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
        )}
      </td>
    </tr>
  )
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
          categories: editProduct.category_slugs?.join(",") ?? editProduct.category_slug ?? "",
          tags: "",
          vendorSlug: editProduct.vendor_slug ?? "",
          status: editProduct.status ?? "active",
          isLimited: editProduct.is_limited,
          isSale: editProduct.is_sale,
          isNew: editProduct.is_new,
          isExclusive: editProduct.is_exclusive,
          allowCustomSize: editProduct.allow_custom_size ?? false,
          description: editProduct.description ?? "",
          material: editProduct.material ?? "",
        }
      : BLANK_DRAFT
  )
  const [variants, setVariants] = useState(editProduct?.variants ?? [])
  const [variantSaving, setVariantSaving] = useState<Record<number, boolean>>({})
  const [sizeVariants, setSizeVariants] = useState<NonNullable<AdminProduct["size_variants"]>>(editProduct?.size_variants ?? [])
  const [newSizeLabel, setNewSizeLabel] = useState("")
  const [newSizePrice, setNewSizePrice] = useState("")
  const [svSaving, setSvSaving] = useState(false)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [saving, setSaving] = useState(false)
  const [mediaItems, setMediaItems] = useState<{ id?: number; src: string; media_type: string }[]>(
    editProduct?.images?.map((i) => ({ id: i.id, src: i.src ?? i.url, media_type: i.media_type ?? "image" })) ?? []
  )
  const [videoUploading, setVideoUploading] = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Load full product (with variants + size_variants) when editing
  useEffect(() => {
    if (!editProduct) return
    adminFetch<AdminProduct>(`/admin/products/${editProduct.id}/`)
      .then((p) => {
        if (p.variants) setVariants(p.variants)
        if (p.size_variants) setSizeVariants(p.size_variants)
      })
      .catch(() => {})
  }, [editProduct?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    adminFetch<{ results?: CategoryOption[]; count?: number } | CategoryOption[]>("/admin/categories/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as { results?: CategoryOption[] }).results ?? []
        setCategories(list)
      })
      .catch(() => {})
  }, [])

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

      const catSlugs = draft.categories.split(",").map((s) => s.trim()).filter(Boolean)
      const body = {
        title: draft.title,
        image_url: draft.imageUrl,
        base_price: draft.price,
        original_price: draft.originalPrice || null,
        regional_prices,
        category_slug_input: catSlugs[0] ?? "",
        categories_input: catSlugs.join(","),
        vendor_slug_input: draft.vendorSlug || undefined,
        status: draft.status,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
        is_limited: draft.isLimited,
        is_sale: draft.isSale,
        is_new: draft.isNew,
        is_exclusive: draft.isExclusive,
        allow_custom_size: draft.allowCustomSize,
        description: draft.description,
        material: draft.material,
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

  async function handleAddSizeVariant() {
    if (!editProduct?.id || !newSizeLabel.trim() || !newSizePrice.trim()) return
    setSvSaving(true)
    try {
      const sv = await adminFetch<{ id: number; label: string; price_usd: string; sort_order: number; is_active: boolean }>("/admin/size-variants/", {
        method: "POST",
        body: JSON.stringify({ product_id: editProduct.id, label: newSizeLabel.trim(), price_usd: newSizePrice.trim(), sort_order: sizeVariants.length }),
      })
      setSizeVariants((prev) => [...prev, sv])
      setNewSizeLabel("")
      setNewSizePrice("")
    } catch { /* noop */ }
    finally { setSvSaving(false) }
  }

  async function handleDeleteSizeVariant(id: number) {
    await adminFetch(`/admin/size-variants/${id}/`, { method: "DELETE" }).catch(() => {})
    setSizeVariants((prev) => prev.filter((sv) => sv.id !== id))
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editProduct?.id) return
    const file = e.target.files?.[0]
    if (!file) return
    setVideoUploading(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
      const form = new FormData()
      form.append("product_id", String(editProduct.id))
      form.append("file", file)
      form.append("media_type", "video")
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const res = await fetch(`${base}/admin/products/media/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (res.ok) {
        const item = await res.json() as { id: number; src: string; media_type: string }
        setMediaItems((prev) => [...prev, { id: item.id, src: item.src, media_type: item.media_type }])
      }
    } catch { /* noop */ }
    finally { setVideoUploading(false); if (videoInputRef.current) videoInputRef.current.value = "" }
  }

  async function handleDeleteMedia(id: number) {
    await adminFetch(`/admin/products/media/${id}/`, { method: "DELETE" }).catch(() => {})
    setMediaItems((prev) => prev.filter((m) => m.id !== id))
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
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Primary Image URL</label>
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

          {/* Media gallery — videos only (images via URL above). Only available after product is saved. */}
          {editProduct?.id && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Media Gallery (Videos)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {mediaItems.filter((m) => m.media_type === "video").map((m, i) => (
                  <div key={m.id ?? i} className="relative group w-24 h-20 rounded-sm overflow-hidden border border-dp-border bg-dp-bg-elevated flex items-center justify-center">
                    <Play size={20} className="text-dp-text-tertiary" />
                    <p className="text-[9px] text-dp-text-tertiary absolute bottom-1 left-0 right-0 text-center truncate px-1">video</p>
                    {m.id && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteMedia(m.id!)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center transition-opacity"
                        aria-label="Delete"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={videoUploading}
                  className="w-24 h-20 rounded-sm border border-dashed border-dp-border hover:border-dp-border-hover flex flex-col items-center justify-center gap-1 text-dp-text-tertiary hover:text-dp-text-secondary transition-colors disabled:opacity-40"
                >
                  {videoUploading ? <span className="text-[10px]">…</span> : <><Upload size={16} /><span className="text-[9px]">Upload video</span></>}
                </button>
              </div>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => void handleVideoUpload(e)} />
              <p className="text-[11px] text-dp-text-tertiary">Upload video files to include in the product carousel. Save the product first before uploading.</p>
            </div>
          )}

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          {/* Categories multi-select */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">
              <Package size={12} className="inline mr-1" />Categories (select multiple)
            </label>
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const selected = draft.categories.split(",").map((s) => s.trim()).includes(cat.slug)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        const current = draft.categories.split(",").map((s) => s.trim()).filter(Boolean)
                        const next = selected ? current.filter((s) => s !== cat.slug) : [...current, cat.slug]
                        set("categories", next.join(","))
                      }}
                      className={`px-2.5 py-1 rounded-sm border text-[11px] font-semibold transition-colors ${
                        selected
                          ? "border-dp-accent-cta bg-dp-accent-cta/10 text-dp-accent-cta"
                          : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"
                      }`}
                    >
                      {cat.name}
                    </button>
                  )
                })}
              </div>
            ) : (
              <input value={draft.categories} onChange={(e) => set("categories", e.target.value)} placeholder="figures,wallpanels"
                className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
            )}
            <p className="text-[10px] text-dp-text-tertiary mt-1">Selected: {draft.categories || "none"}</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Tags (comma-sep)</label>
            <input value={draft.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Anime, Dragon"
              className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
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
                { key: "allowCustomSize", label: "Allow custom size (shows contact button)" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft[key] as boolean} onChange={() => set(key, !draft[key])} className="w-3.5 h-3.5 accent-dp-accent-cta" />
                  <span className="text-[12px] text-dp-text-secondary">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Description</label>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Product description shown on the product page…"
              className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1.5">Material</label>
            <input
              value={draft.material}
              onChange={(e) => set("material", e.target.value)}
              placeholder="e.g. Aluminium + UV ink"
              className="w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
            />
          </div>

          {/* Size variants manager */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                <Layers size={12} className="inline mr-1" />Size Variants &amp; Prices
              </p>
              {!editProduct?.id && <p className="text-[10px] text-dp-text-tertiary">Save product first to add sizes</p>}
            </div>
            {sizeVariants.length > 0 && (
              <div className="border border-dp-border rounded-sm overflow-hidden mb-2">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-dp-bg-elevated border-b border-dp-border">
                      <th className="text-left px-3 py-2 text-dp-text-tertiary font-semibold">Label</th>
                      <th className="text-right px-3 py-2 text-dp-text-tertiary font-semibold">Price (USD)</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sizeVariants.map((sv) => (
                      <tr key={sv.id} className="border-b border-dp-border last:border-0">
                        <td className="px-3 py-2 text-dp-text-primary font-semibold">{sv.label}</td>
                        <td className="px-3 py-2 text-right text-dp-text-primary">${parseFloat(sv.price_usd).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeleteSizeVariant(sv.id)}
                            className="text-dp-text-tertiary hover:text-red-400 transition-colors"
                            aria-label="Delete size"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editProduct?.id && (
              <div className="flex gap-2">
                <input
                  value={newSizeLabel}
                  onChange={(e) => setNewSizeLabel(e.target.value)}
                  placeholder="e.g. S / 30x40cm"
                  className="flex-1 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                />
                <input
                  type="number" min={0} step={0.01}
                  value={newSizePrice}
                  onChange={(e) => setNewSizePrice(e.target.value)}
                  placeholder="Price $"
                  className="w-24 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                />
                <button
                  type="button"
                  onClick={() => void handleAddSizeVariant()}
                  disabled={svSaving || !newSizeLabel.trim() || !newSizePrice.trim()}
                  className="px-3 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors"
                >
                  {svSaving ? "…" : <><Plus size={12} /></>}
                </button>
              </div>
            )}
          </div>

          {/* Legacy variants (shown only if product still has them and no size_variants) */}
          {editProduct && variants.length > 0 && sizeVariants.length === 0 && (
            <details className="border border-dp-border rounded-sm">
              <summary className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary cursor-pointer">Legacy Variants (Poster Size/Finish/Frame)</summary>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-dp-bg-elevated border-b border-dp-border">
                      <th className="text-left px-3 py-2 text-dp-text-tertiary font-semibold">Size</th>
                      <th className="text-left px-3 py-2 text-dp-text-tertiary font-semibold">Finish</th>
                      <th className="text-left px-3 py-2 text-dp-text-tertiary font-semibold">Frame</th>
                      <th className="text-right px-3 py-2 text-dp-text-tertiary font-semibold">Surcharge ($)</th>
                      <th className="text-right px-3 py-2 text-dp-text-tertiary font-semibold">Final Price</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <VariantRow
                        key={v.id}
                        variant={v}
                        basePrice={parseFloat(draft.price) || 0}
                        saving={!!variantSaving[v.id]}
                        onSave={async (newSurcharge) => {
                          setVariantSaving((s) => ({ ...s, [v.id]: true }))
                          try {
                            const result = await adminFetch<{ id: number; surcharge: string }>(`/admin/products/variants/${v.id}/stock/`, {
                              method: "PATCH",
                              body: JSON.stringify({ surcharge: newSurcharge }),
                            })
                            setVariants((prev) => prev.map((x) => x.id === v.id ? { ...x, surcharge: result.surcharge } : x))
                          } catch { /* noop */ }
                          finally { setVariantSaving((s) => ({ ...s, [v.id]: false })) }
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
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
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

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

  function handleExport() {
    const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
    // Trigger download via hidden anchor
    const a = document.createElement("a")
    a.href = `${base}/admin/products/export/`
    a.download = "products_export.xlsx"
    if (token) {
      // Fetch with auth then blob-download
      fetch(`${base}/admin/products/export/`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          a.href = url
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        })
        .catch(() => {})
    }
  }

  function handleDownloadTemplate() {
    const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
    fetch(`${base}/admin/products/import/`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = "products_template.xlsx"
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch(() => {})
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`${base}/admin/products/import/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const result = await res.json() as { created: number; errors: { row: number; error: string }[] }
      alert(`Import complete: ${result.created} products created.${result.errors.length ? ` ${result.errors.length} errors.` : ""}`)
      // Refresh list
      adminFetch<AdminProduct[]>(listEndpoint)
        .then((d) => setProducts(Array.isArray(d) ? d : []))
        .catch(() => {})
    } catch {
      alert("Import failed.")
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ""
    }
  }

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

      <div className="p-4 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Products</h1>
            <p className="text-[13px] text-dp-text-tertiary mt-1">
              {isVendor ? "Your product listings." : "All products across all vendors."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-dp-border-hover transition-colors"
              title="Download Excel import template"
            >
              <Download size={13} /> Template
            </button>
            <label className={`flex items-center gap-1.5 px-3 py-2.5 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-dp-border-hover transition-colors cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`} title="Import products from Excel">
              <FileUp size={13} /> {importing ? "Importing…" : "Import"}
              <input ref={importInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleImport(e)} />
            </label>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-dp-border-hover transition-colors"
              title="Export all products to Excel"
            >
              <Download size={13} /> Export
            </button>
            <button onClick={() => { setEditTarget(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
              <Plus size={14} /> Add Product
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
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
