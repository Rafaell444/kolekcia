"use client"

import React, { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { Plus, Search, Pencil, Trash2, X, Package, Play, Upload, Download, FileUp, Video, Image as ImageIcon2, FolderPlus } from "lucide-react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"

type SizeVariantItem = {
  id: number
  label: string
  price_usd: string
  price_gel?: string | null
  price_eur?: string | null
  price_gbp?: string | null
  sort_order: number
  is_active: boolean
}

type AdminProduct = {
  id: number; title: string; artist_name: string; base_price: string
  regional_prices?: Record<string, { price?: string; original?: string | null }>
  image_url?: string
  images: { id?: number; url: string; src?: string; media_type?: string }[]; is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean
  allow_custom_size?: boolean
  category_slug: string
  category_slugs?: string[]
  tags?: string[]
  status?: "active" | "paused" | "sold"
  vendor_slug?: string | null
  vendor_name?: string | null
  description?: string
  material?: string
  size_variants?: SizeVariantItem[]
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

type PendingVariant = {
  _key: string
  label: string
  priceUsd: string
  priceGel: string
}

type ProductDraft = {
  title: string
  categories: string
  tags: string
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
  title: "",
  categories: "", tags: "", vendorSlug: "",
  status: "active",
  isLimited: false, isSale: false, isNew: true, isExclusive: false,
  allowCustomSize: false,
  description: "", material: "",
}

const INPUT_CLS = "w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
const LABEL_CLS = "block text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1"

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
          categories: editProduct.category_slugs?.join(",") ?? editProduct.category_slug ?? "",
          tags: Array.isArray(editProduct.tags) ? editProduct.tags.join(", ") : "",
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

  // Existing saved media (from server)
  const [mediaItems, setMediaItems] = useState<{ id?: number; src: string; media_type: string; name?: string }[]>(
    editProduct?.images?.map((i) => ({ id: i.id, src: i.src ?? i.url, media_type: i.media_type ?? "image" })) ?? []
  )
  // Pending files to upload on save (new product or additional files)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string; media_type: string }[]>([])
  const mediaInputRef = useRef<HTMLInputElement>(null)

  // Size variants - existing (saved) and pending (to be created on save)
  const [sizeVariants, setSizeVariants] = useState<SizeVariantItem[]>(editProduct?.size_variants ?? [])
  const [pendingVariants, setPendingVariants] = useState<PendingVariant[]>([])
  const newVarRef = useRef({ label: "", priceUsd: "", priceGel: "" })
  const [newVarDraft, setNewVarDraft] = useState({ label: "", priceUsd: "", priceGel: "" })

  // Categories
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [creatingCat, setCreatingCat] = useState(false)
  const [catError, setCatError] = useState("")

  // Available tags (fetched from filter-options)
  const [availableTags, setAvailableTags] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [savingStep, setSavingStep] = useState("")
  const [error, setError] = useState("")

  // Load full product detail when editing (list endpoint may lack tags, description, etc.)
  const detailBase = endpoint.endsWith("/") ? endpoint : endpoint + "/"
  useEffect(() => {
    if (!editProduct) return
    adminFetch<AdminProduct>(`${detailBase}${editProduct.id}/`)
      .then((p) => {
        if (p.size_variants) setSizeVariants(p.size_variants)
        if (p.images) setMediaItems(p.images.map((i) => ({ id: i.id, src: i.src ?? i.url, media_type: i.media_type ?? "image" })))
        setDraft((prev) => ({
          ...prev,
          title: p.title ?? prev.title,
          categories: p.category_slugs?.join(",") ?? prev.categories,
          tags: Array.isArray(p.tags) ? p.tags.join(", ") : prev.tags,
          vendorSlug: p.vendor_slug ?? prev.vendorSlug,
          status: p.status ?? prev.status,
          isLimited: p.is_limited ?? prev.isLimited,
          isSale: p.is_sale ?? prev.isSale,
          isNew: p.is_new ?? prev.isNew,
          isExclusive: p.is_exclusive ?? prev.isExclusive,
          allowCustomSize: p.allow_custom_size ?? prev.allowCustomSize,
          description: p.description ?? prev.description,
          material: p.material ?? prev.material,
        }))
      })
      .catch(() => {})
  }, [editProduct?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    adminFetch<{ results?: CategoryOption[] } | CategoryOption[]>("/admin/categories/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as { results?: CategoryOption[] }).results ?? []
        setCategories(list)
      })
      .catch(() => {})
    // Fetch available tags for pill selector
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"}/products/filter-options/`)
      .then((r) => r.json())
      .then((d: { themes?: string[] }) => { if (Array.isArray(d.themes)) setAvailableTags(d.themes) })
      .catch(() => {})
  }, [])

  function set<K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  function toggleCategory(slug: string) {
    const current = draft.categories.split(",").map((s) => s.trim()).filter(Boolean)
    const selected = current.includes(slug)
    const next = selected ? current.filter((s) => s !== slug) : [...current, slug]
    set("categories", next.join(","))
  }

  async function createCategory() {
    if (!newCatName.trim()) return
    setCreatingCat(true)
    setCatError("")
    try {
      const slug = newCatName.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "")
      const cat = await adminFetch<CategoryOption>("/admin/categories/", {
        method: "POST",
        body: JSON.stringify({ name: newCatName.trim(), slug }),
      })
      setCategories((prev) => [...prev, cat])
      toggleCategory(cat.slug)
      setNewCatName("")
      setShowNewCat(false)
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string; slug?: string[] } }
      setCatError(e?.data?.detail ?? (e?.data?.slug?.[0]) ?? "Failed to create category.")
    }
    finally { setCreatingCat(false) }
  }

  function addPendingFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const newItems = files.map((file) => {
      const isVideo = file.type.startsWith("video/")
      return { file, preview: isVideo ? "" : URL.createObjectURL(file), media_type: isVideo ? "video" : "image" }
    })
    setPendingFiles((prev) => [...prev, ...newItems])
    if (mediaInputRef.current) mediaInputRef.current.value = ""
  }

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => {
      const item = prev[idx]
      if (item.preview) URL.revokeObjectURL(item.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleDeleteMedia(id: number) {
    await adminFetch(`/admin/products/media/${id}/`, { method: "DELETE" }).catch(() => {})
    setMediaItems((prev) => prev.filter((m) => m.id !== id))
  }

  async function uploadFile(productId: number, item: { file: File; media_type: string }) {
    const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
    const form = new FormData()
    form.append("product_id", String(productId))
    form.append("file", item.file)
    form.append("media_type", item.media_type)
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
    const res = await fetch(`${base}/admin/products/media/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string }
      throw new Error(err.detail ?? `Media upload failed (${res.status})`)
    }
    return res.json()
  }

  function addPendingVariant() {
    if (!newVarDraft.label.trim() || !newVarDraft.priceUsd.trim()) return
    setPendingVariants((prev) => [
      ...prev,
      { _key: `${Date.now()}-${Math.random()}`, ...newVarDraft },
    ])
    setNewVarDraft({ label: "", priceUsd: "", priceGel: "" })
  }

  function removePendingVariant(key: string) {
    setPendingVariants((prev) => prev.filter((v) => v._key !== key))
  }

  async function handleDeleteSizeVariant(id: number) {
    await adminFetch(`/admin/size-variants/${id}/`, { method: "DELETE" }).catch(() => {})
    setSizeVariants((prev) => prev.filter((sv) => sv.id !== id))
  }

  async function handleSave() {
    if (!draft.title) { setError("Title is required."); return }
    setSaving(true)
    setError("")
    try {
      const catSlugs = draft.categories.split(",").map((s) => s.trim()).filter(Boolean)

      // Derive base_price from first variant (or 0 if none)
      const firstVariantPrice = pendingVariants[0]?.priceUsd || sizeVariants[0]?.price_usd || "0"

      const body = {
        title: draft.title,
        base_price: firstVariantPrice,
        regional_prices: {},
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
      setSavingStep("Saving product…")
      if (editProduct) {
        saved = await adminFetch<AdminProduct>(`${endpoint}${editProduct.id}/`, {
          method: "PATCH", body: JSON.stringify(body),
        })
      } else {
        saved = await adminFetch<AdminProduct>(endpoint, { method: "POST", body: JSON.stringify(body) })
      }

      const productId = saved.id

      // Upload pending media files
      if (pendingFiles.length > 0) {
        setSavingStep(`Uploading ${pendingFiles.length} media file${pendingFiles.length > 1 ? "s" : ""}…`)
        for (const item of pendingFiles) {
          await uploadFile(productId, item)
        }
      }

      // Create pending variants
      if (pendingVariants.length > 0) {
        setSavingStep(`Creating ${pendingVariants.length} size variant${pendingVariants.length > 1 ? "s" : ""}…`)
        for (const v of pendingVariants) {
          await adminFetch("/admin/size-variants/", {
            method: "POST",
            body: JSON.stringify({
              product_id: productId,
              label: v.label,
              price_usd: v.priceUsd,
              price_gel: v.priceGel || null,
              price_eur: null,
              price_gbp: null,
              sort_order: sizeVariants.length + pendingVariants.indexOf(v),
            }),
          })
        }
      }

      // Reload full product to get updated media + variants
      const fresh = await adminFetch<AdminProduct>(`${detailBase}${productId}/`)
      if (fresh.size_variants) setSizeVariants(fresh.size_variants)
      if (fresh.images) {
        setMediaItems(fresh.images.map((i) => ({ id: i.id, src: i.src ?? i.url, media_type: i.media_type ?? "image" })))
      }
      setPendingVariants([])
      setPendingFiles([])
      onSaved(fresh)
      onClose()
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown> }
      if (e?.data) {
        const detail = e.data.detail
        if (typeof detail === "string" && detail.trim()) {
          setError(detail)
        } else {
          const fieldErrors = Object.entries(e.data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ")
          setError(fieldErrors || "Save failed.")
        }
      } else {
        setError(err instanceof Error ? err.message : "Save failed.")
      }
    } finally {
      setSaving(false)
      setSavingStep("")
    }
  }

  const selectedCatSlugs = draft.categories.split(",").map((s) => s.trim()).filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto py-4 px-2 sm:px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border sticky top-0 bg-dp-bg-surface z-10">
          <h2 className="font-display text-xl sm:text-2xl text-dp-text-primary">{editProduct ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary transition-colors p-1" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="p-5 sm:p-6 flex flex-col gap-6">
          {error && <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-sm px-3 py-2">{error}</p>}

          {/* ── Top 2-column grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: basic info */}
            <div className="flex flex-col gap-4">
              <div>
                <label className={LABEL_CLS}>Title *</label>
                <input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Neon Dragon"
                  className={INPUT_CLS} />
              </div>

              <div>
                <label className={LABEL_CLS}>Description</label>
                <textarea rows={4} value={draft.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="Product description shown on the product page…"
                  className={`${INPUT_CLS} resize-none`} />
              </div>

              <div>
                <label className={LABEL_CLS}>Material</label>
                <input value={draft.material} onChange={(e) => set("material", e.target.value)} placeholder="e.g. Aluminium + UV ink" className={INPUT_CLS} />
              </div>

              {/* Tags as pill selector */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className={LABEL_CLS + " mb-0"}>Tags / Themes</label>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {availableTags.map((tag) => {
                    const selected = draft.tags.split(",").map((t) => t.trim().toLowerCase()).includes(tag.toLowerCase())
                    return (
                      <button key={tag} type="button"
                        onClick={() => {
                          const cur = draft.tags.split(",").map((t) => t.trim()).filter(Boolean)
                          const next = selected ? cur.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...cur, tag]
                          set("tags", next.join(", "))
                        }}
                        className={`px-2.5 py-1 rounded-sm border text-[11px] font-semibold transition-colors ${
                          selected ? "border-dp-accent-cta bg-dp-accent-cta/10 text-dp-accent-cta" : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"
                        }`}>
                        {tag}
                      </button>
                    )
                  })}
                </div>
                <input value={draft.tags} onChange={(e) => set("tags", e.target.value)}
                  placeholder="Or type custom tags, comma-separated…" className={INPUT_CLS} />
              </div>

              {/* Flags */}
              <div>
                <p className={LABEL_CLS}>Flags</p>
                <div className="flex flex-wrap gap-3">
                  {([
                    { key: "isLimited", label: "Limited" },
                    { key: "isSale", label: "Sale" },
                    { key: "isNew", label: "New" },
                    { key: "isExclusive", label: "Exclusive" },
                    { key: "allowCustomSize", label: "Allow custom size" },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={draft[key] as boolean} onChange={() => set(key, !draft[key])} className="w-3.5 h-3.5 accent-dp-accent-cta" />
                      <span className="text-[11px] text-dp-text-secondary">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: media + categories + status */}
            <div className="flex flex-col gap-4">
              {/* Media upload */}
              <div>
                <label className={LABEL_CLS}>Images &amp; Videos</label>
                {/* Saved media */}
                {mediaItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {mediaItems.map((m, i) => (
                      <div key={m.id ?? i} className="relative group w-20 h-16 rounded-sm overflow-hidden border border-dp-border bg-dp-bg-elevated flex items-center justify-center shrink-0">
                        {m.media_type === "video" ? (
                          <>
                            <Play size={18} className="text-dp-text-tertiary" />
                            <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-dp-text-tertiary">video</span>
                          </>
                        ) : (
                          m.src && <Image src={m.src} alt="" fill className="object-cover" sizes="80px" />
                        )}
                        {m.id && (
                          <button type="button" onClick={() => void handleDeleteMedia(m.id!)}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center transition-opacity" aria-label="Delete">
                            <X size={8} className="text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Pending files */}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {pendingFiles.map((pf, i) => (
                      <div key={i} className="relative group w-20 h-16 rounded-sm overflow-hidden border border-dp-accent-cta/40 bg-dp-bg-elevated flex items-center justify-center shrink-0">
                        {pf.media_type === "video" ? (
                          <>
                            <Video size={16} className="text-dp-accent-cta" />
                            <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-dp-text-tertiary truncate px-1">{pf.file.name}</span>
                          </>
                        ) : pf.preview ? (
                          <Image src={pf.preview} alt="" fill className="object-cover" sizes="80px" />
                        ) : (
                          <ImageIcon2 size={16} className="text-dp-accent-cta" />
                        )}
                        <span className="absolute top-0 left-0 bg-dp-accent-cta text-white text-[7px] px-1 rounded-br">new</span>
                        <button type="button" onClick={() => removePendingFile(i)}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center transition-opacity" aria-label="Remove">
                          <X size={8} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => mediaInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-dp-border hover:border-dp-accent-cta/50 rounded-sm text-[11px] text-dp-text-tertiary hover:text-dp-text-secondary transition-colors w-full justify-center">
                  <Upload size={14} /> Add images or videos
                </button>
                <input ref={mediaInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={addPendingFile} />
                <p className="text-[10px] text-dp-text-tertiary mt-1">
                  {editProduct ? "Existing media shown above. New uploads will be added on save." : "Files will be uploaded when you save."}
                </p>
              </div>

              {/* Categories */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className={LABEL_CLS + " mb-0"}>
                    <Package size={10} className="inline mr-1" />Categories
                  </label>
                  <button type="button" onClick={() => setShowNewCat((v) => !v)}
                    className="ml-auto flex items-center gap-1 text-[10px] text-dp-accent-cta hover:underline">
                    <FolderPlus size={10} /> New category
                  </button>
                </div>
                {showNewCat && (
                  <div className="mb-2 flex flex-col gap-1">
                    <div className="flex gap-2">
                      <input value={newCatName} onChange={(e) => { setNewCatName(e.target.value); setCatError("") }} placeholder="Category name…"
                        className={`${INPUT_CLS} flex-1`}
                        onKeyDown={(e) => { if (e.key === "Enter") void createCategory() }} />
                      <button type="button" onClick={() => void createCategory()} disabled={creatingCat || !newCatName.trim()}
                        className="px-3 py-2 bg-dp-accent-cta text-white text-[10px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50">
                        {creatingCat ? "…" : "Create"}
                      </button>
                    </div>
                    {catError && <p className="text-[10px] text-red-400">{catError}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const sel = selectedCatSlugs.includes(cat.slug)
                    return (
                      <button key={cat.id} type="button" onClick={() => toggleCategory(cat.slug)}
                        className={`px-2.5 py-1 rounded-sm border text-[11px] font-semibold transition-colors ${
                          sel ? "border-dp-accent-cta bg-dp-accent-cta/10 text-dp-accent-cta" : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"
                        }`}>
                        {cat.name}
                      </button>
                    )
                  })}
                  {categories.length === 0 && (
                    <p className="text-[11px] text-dp-text-tertiary">No categories yet — create one above.</p>
                  )}
                </div>
              </div>

              {/* Status + vendor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Status</label>
                  <select value={draft.status} onChange={(e) => set("status", e.target.value as ProductDraft["status"])} className={INPUT_CLS}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>
                {!isVendor && (
                  <div>
                    <label className={LABEL_CLS}>Assign Vendor</label>
                    <select value={draft.vendorSlug} onChange={(e) => set("vendorSlug", e.target.value)} className={INPUT_CLS}>
                      <option value="">Unassigned</option>
                      {vendors.map((v) => <option key={v.id} value={v.slug}>{v.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Size Variants (full width) ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">
              Size Variants &amp; Prices <span className="font-normal text-dp-text-tertiary ml-1">(all prices on each variant)</span>
            </p>

            {/* Existing variants table */}
            {sizeVariants.length > 0 && (
              <div className="border border-dp-border rounded-sm overflow-x-auto mb-3">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-dp-bg-elevated border-b border-dp-border text-dp-text-tertiary text-[10px] font-semibold uppercase tracking-wide">
                      <th className="text-left px-3 py-2">Label</th>
                      <th className="text-right px-3 py-2">Other market (USD $)</th>
                      <th className="text-right px-3 py-2">Georgian market (GEL ₾)</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sizeVariants.map((sv) => (
                      <tr key={sv.id} className="border-b border-dp-border last:border-0 hover:bg-dp-bg-elevated/40 transition-colors">
                        <td className="px-3 py-2 font-semibold text-dp-text-primary">{sv.label}</td>
                        <td className="px-3 py-2 text-right text-dp-text-primary">${parseFloat(sv.price_usd).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-dp-text-secondary">{sv.price_gel ? `₾${parseFloat(sv.price_gel).toFixed(2)}` : <span className="text-dp-text-tertiary">—</span>}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => void handleDeleteSizeVariant(sv.id)}
                            className="text-dp-text-tertiary hover:text-red-400 transition-colors" aria-label="Delete">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pending variants */}
            {pendingVariants.length > 0 && (
              <div className="border border-dp-accent-cta/30 rounded-sm overflow-x-auto mb-3 bg-dp-accent-cta/5">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-dp-accent-cta/20 text-dp-text-tertiary text-[10px] font-semibold uppercase tracking-wide">
                      <th className="text-left px-3 py-1.5 text-dp-accent-cta">Pending (saved on submit)</th>
                      <th className="text-right px-3 py-1.5">USD $</th>
                      <th className="text-right px-3 py-1.5">GEL ₾</th>
                      <th className="px-3 py-1.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {pendingVariants.map((v) => (
                      <tr key={v._key} className="border-b border-dp-accent-cta/10 last:border-0">
                        <td className="px-3 py-1.5 font-semibold text-dp-text-primary">{v.label}</td>
                        <td className="px-3 py-1.5 text-right">{v.priceUsd ? `$${v.priceUsd}` : "—"}</td>
                        <td className="px-3 py-1.5 text-right">{v.priceGel ? `₾${v.priceGel}` : "—"}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button type="button" onClick={() => removePendingVariant(v._key)}
                            className="text-dp-text-tertiary hover:text-red-400 transition-colors" aria-label="Remove">
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add new variant row */}
            <div className="border border-dp-border rounded-sm p-3 grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className={LABEL_CLS}>Label *</label>
                <input value={newVarDraft.label} onChange={(e) => setNewVarDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. M / 50×70cm" className={INPUT_CLS}
                  onKeyDown={(e) => { if (e.key === "Enter") addPendingVariant() }} />
              </div>
              <div>
                <label className={LABEL_CLS}>Other market (USD $) *</label>
                <input type="number" min={0} step={0.01} value={newVarDraft.priceUsd}
                  onChange={(e) => setNewVarDraft((d) => ({ ...d, priceUsd: e.target.value }))}
                  placeholder="0.00" className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Georgian market (GEL ₾)</label>
                <input type="number" min={0} step={0.01} value={newVarDraft.priceGel}
                  onChange={(e) => setNewVarDraft((d) => ({ ...d, priceGel: e.target.value }))}
                  placeholder="0.00" className={INPUT_CLS} />
              </div>
              <div>
                <button type="button" onClick={addPendingVariant}
                  disabled={!newVarDraft.label.trim() || !newVarDraft.priceUsd.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white text-[11px] font-bold rounded-sm transition-colors whitespace-nowrap">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            <p className="text-[10px] text-dp-text-tertiary mt-1.5">Leave GEL blank to auto-convert from USD on the storefront for Georgian users.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-dp-border bg-dp-bg-elevated sticky bottom-0">
          {savingStep ? (
            <p className="text-[11px] text-dp-text-tertiary animate-pulse">{savingStep}</p>
          ) : <span />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-dp-border-hover transition-colors">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={saving}
              className="px-6 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors">
              {saving ? "Saving…" : editProduct ? "Save Changes" : "Create Product"}
            </button>
          </div>
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
              const firstImg = p.images?.find((i) => (i.media_type ?? "image") === "image") ?? p.images?.[0]
              const thumb = firstImg?.src ?? firstImg?.url ?? p.image_url ?? ""
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
                      {p.size_variants && p.size_variants.length > 0 ? (
                        <span className="text-[12px] font-bold text-dp-text-primary">${parseFloat(p.size_variants[0].price_usd).toFixed(2)}+</span>
                      ) : (
                        <span className="text-[12px] font-bold text-dp-text-primary">${parseFloat(p.base_price).toFixed(2)}</span>
                      )}
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
