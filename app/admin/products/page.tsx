"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Plus, Search, Pencil, Trash2, X, Package, Play, Upload, Download, FileUp, Video, Image as ImageIcon2, FolderPlus, GripVertical, Check, Crop, Tag } from "lucide-react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import TranslationFields from "@/components/admin/TranslationFields"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type SizeVariantItem = {
  id: number
  sku?: string | null
  label: string
  label_ka?: string
  label_ru?: string
  price_usd: string
  price_gel?: string | null
  price_eur?: string | null
  price_gbp?: string | null
  sale_price_usd?: string | null
  sale_price_gel?: string | null
  sort_order: number
  is_active: boolean
  stock?: number | null
  is_ready_to_ship?: boolean
  images?: { id: number; url: string; src?: string; media_type?: string }[]
}

type AdminProduct = {
  id: number; title: string; title_ka?: string; title_ru?: string; artist_name: string; base_price: string
  regional_prices?: Record<string, { price?: string; original?: string | null }>
  image_url?: string
  images: { id?: number; url: string; src?: string; media_type?: string }[]; is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean; is_featured?: boolean
  allow_custom_size?: boolean
  category_slug: string
  category_slugs?: string[]
  tags?: string[]
  tags_ka?: string[]
  tags_ru?: string[]
  status?: "active" | "paused" | "sold"
  vendor_slug?: string | null
  vendor_name?: string | null
  description?: string; description_ka?: string; description_ru?: string
  material?: string
  material_ka?: string
  material_ru?: string
  processing_time_label?: string
  processing_time_label_ka?: string
  processing_time_label_ru?: string
  processing_options?: ProcessingOptionItem[]
  product_details?: string[]
  product_details_ka?: string[]
  product_details_ru?: string[]
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
  labelKa: string
  labelRu: string
  sku: string
  stock: string
  priceUsd: string
  priceGel: string
  salePriceUsd: string
  salePriceGel: string
}

type ProductDraft = {
  title: string
  title_ka: string; title_ru: string
  categories: string
  tags: string
  tags_ka: string
  tags_ru: string
  vendorSlug: string
  status: "active" | "paused" | "sold"
  isLimited: boolean; isSale: boolean; isNew: boolean; isExclusive: boolean; isFeatured: boolean; isReadyToShip: boolean
  allowCustomSize: boolean
  description: string
  description_ka: string; description_ru: string
  material: string
  material_ka: string
  material_ru: string
  processingTimeLabel: string
  processingTimeLabel_ka: string
  processingTimeLabel_ru: string
  processingOptionIds: number[]
  productDetails: string
  productDetails_ka: string
  productDetails_ru: string
}

type ProcessingOptionItem = {
  id: number
  slug?: string
  label: string
  label_ka?: string
  label_ru?: string
  est_days_min: number
  est_days_max: number
  price_usd: string | number
  price_gel: string | number
  is_included: boolean
  vendor_slug?: string
  is_active?: boolean
}

type CategoryOption = { id: number; name: string; name_ka?: string; name_ru?: string; slug: string }

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

function formatPriceRange(values: Array<number | null>, prefix: string): string {
  const nums = values.filter((value): value is number => value != null && !Number.isNaN(value))
  if (nums.length === 0) return "—"
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (min === max) return `${prefix}${min.toFixed(2)}`
  return `${prefix}${min.toFixed(2)}-${prefix}${max.toFixed(2)}`
}

function productCardPriceRanges(p: AdminProduct): { usd: string; gel: string } {
  if (p.size_variants && p.size_variants.length > 0) {
    return {
      usd: formatPriceRange(
        p.size_variants.map((sv) => parseFloat(String(sv.sale_price_usd || sv.price_usd || "0"))),
        "$",
      ),
      gel: formatPriceRange(
        p.size_variants.map((sv) => {
          const raw = sv.sale_price_gel || sv.price_gel
          return raw ? parseFloat(String(raw)) : null
        }),
        "₾",
      ),
    }
  }
  return {
    usd: formatPriceRange([parseFloat(String(p.base_price || "0"))], "$"),
    gel: formatPriceRange([p.regional_prices?.GEL?.price ? parseFloat(String(p.regional_prices.GEL.price)) : null], "₾"),
  }
}

const BLANK_DRAFT: ProductDraft = {
  title: "",
  title_ka: "", title_ru: "",
  categories: "", tags: "", tags_ka: "", tags_ru: "", vendorSlug: "",
  status: "active",
  isLimited: false, isSale: false, isNew: false, isExclusive: false, isFeatured: false, isReadyToShip: false,
  allowCustomSize: false,
  processingTimeLabel: "",
  processingTimeLabel_ka: "", processingTimeLabel_ru: "",
  processingOptionIds: [],
  productDetails: "", productDetails_ka: "", productDetails_ru: "",
  description: "", description_ka: "", description_ru: "", material: "", material_ka: "", material_ru: "",
}

const INPUT_CLS = "w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
const LABEL_CLS = "block text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1"

// ─── Etsy-style Thumbnail Editor ─────────────────────────────────
// Product card uses aspect-poster = 1/1.4 (width:height). We use the same ratio
// for the editor viewport and for canvas export so what you see is what you get.
const POSTER_W = 5
const POSTER_H = 7 // 1 : 1.4

function ThumbnailEditorModal({
  image,
  productId,
  onApply,
  onClose,
}: {
  image: { id?: number; src: string }
  productId?: number
  onApply: (newImageId?: number) => void
  onClose: () => void
}) {
  const VP_W = 280
  const VP_H = Math.round(VP_W * POSTER_H / POSTER_W) // ~392 — matches product card ratio

  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [applying, setApplying] = useState(false)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })

  function clamp(val: number, lo: number, hi: number) { return Math.min(Math.max(val, lo), hi) }

  function maxOffset(z: number) {
    return {
      maxX: ((z - 1) * VP_W) / 2 / z,
      maxY: ((z - 1) * VP_H) / 2 / z,
    }
  }

  function applyZoom(z: number) {
    const cz = clamp(z, 1, 3)
    const { maxX, maxY } = maxOffset(cz)
    setZoom(cz)
    setOffsetX((prev) => clamp(prev, -maxX, maxX))
    setOffsetY((prev) => clamp(prev, -maxY, maxY))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    const dx = (e.clientX - dragStart.current.x) / zoom
    const dy = (e.clientY - dragStart.current.y) / zoom
    const { maxX, maxY } = maxOffset(zoom)
    setOffsetX(clamp(dragStart.current.ox + dx, -maxX, maxX))
    setOffsetY(clamp(dragStart.current.oy + dy, -maxY, maxY))
  }

  function onPointerUp() { isDragging.current = false }

  // Export the current view to a canvas at high resolution (5× the viewport)
  async function exportToBlob(): Promise<Blob> {
    const SCALE = 5
    const cW = VP_W * SCALE
    const cH = VP_H * SCALE
    const canvas = document.createElement("canvas")
    canvas.width = cW
    canvas.height = cH
    const ctx = canvas.getContext("2d")!
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error("Image load failed"))
      img.src = image.src
    })
    ctx.save()
    ctx.translate(cW / 2, cH / 2)
    ctx.scale(zoom, zoom)
    ctx.translate(offsetX * SCALE, offsetY * SCALE)
    // Draw image centred, covering the entire canvas
    const imgAspect = img.naturalWidth / img.naturalHeight
    const canvasAspect = cW / cH
    let dw: number, dh: number
    if (imgAspect > canvasAspect) {
      dh = cH / zoom; dw = dh * imgAspect
    } else {
      dw = cW / zoom; dh = dw / imgAspect
    }
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
    return new Promise((res, rej) => {
      canvas.toBlob((b) => b ? res(b) : rej(new Error("Canvas export failed")), "image/jpeg", 0.92)
    })
  }

  async function handleApply() {
    setApplying(true)
    try {
      const blob = await exportToBlob()
      // If we have a product ID, upload the cropped image
      if (productId) {
        const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
        const form = new FormData()
        form.append("product_id", String(productId))
        form.append("file", blob, "thumbnail.jpg")
        form.append("media_type", "image")
        const resp = await fetch(`${base}/admin/products/media/`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        })
        if (resp.ok) {
          const data = await resp.json() as { id?: number }
          onApply(data.id)
          return
        }
      }
      onApply(undefined)
    } catch {
      onApply(undefined)
    } finally {
      setApplying(false)
    }
  }

  const imgStyle: React.CSSProperties = {
    transform: `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`,
    transformOrigin: "center",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    userSelect: "none",
    pointerEvents: "none",
    display: "block",
  }

  // Small preview card using the exact product card ratio
  const PreviewCard = ({ size }: { size: "lg" | "sm" }) => {
    const w = size === "lg" ? "w-40" : "w-24"
    return (
      <div className={`flex flex-col gap-1.5 ${w} shrink-0`}>
        <p className="text-[10px] text-dp-text-tertiary">{size === "lg" ? "Product card" : "Small"}</p>
        <div className="bg-[#f4f4f4] rounded-sm border border-dp-border p-1.5">
          {/* aspect-poster = 1/1.4 */}
          <div className="overflow-hidden rounded-sm" style={{ aspectRatio: `${POSTER_W} / ${POSTER_H}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt="" style={imgStyle} />
          </div>
          <div className="mt-1.5 space-y-1">
            <div className="h-1.5 bg-dp-border rounded-sm w-3/4" />
            <div className="h-1.5 bg-dp-border rounded-sm w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 overflow-y-auto py-6 px-4" role="dialog" aria-modal="true">
      <div className="max-w-3xl mx-auto bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border sticky top-0 bg-dp-bg-surface z-10">
          <div className="flex items-center gap-2">
            <Crop size={16} className="text-dp-accent-cta" />
            <h2 className="font-display text-xl text-dp-text-primary">Adjust Thumbnail</h2>
          </div>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col lg:flex-row gap-6 items-start">
          {/* Left — editor viewport (product card ratio) */}
          <div className="shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Drag to adjust · Product card view</p>
            <div
              className="overflow-hidden rounded-sm border border-dp-border cursor-grab active:cursor-grabbing select-none"
              style={{ width: VP_W, height: VP_H }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt="Thumbnail editor" style={imgStyle} draggable={false} />
            </div>
            {/* Zoom slider */}
            <div className="flex items-center gap-2 mt-3">
              <button type="button" onClick={() => applyZoom(zoom - 0.1)}
                className="w-6 h-6 flex items-center justify-center border border-dp-border rounded-sm text-dp-text-secondary hover:border-dp-border-hover text-lg leading-none">−</button>
              <input type="range" min={1} max={3} step={0.01} value={zoom}
                onChange={(e) => applyZoom(parseFloat(e.target.value))} className="flex-1" />
              <button type="button" onClick={() => applyZoom(zoom + 0.1)}
                className="w-6 h-6 flex items-center justify-center border border-dp-border rounded-sm text-dp-text-secondary hover:border-dp-border-hover text-lg leading-none">+</button>
            </div>
            <p className="text-[10px] text-dp-text-tertiary text-center mt-1">{Math.round(zoom * 100)}%</p>
          </div>

          {/* Right — previews at various card sizes */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3">What buyers will see</p>
            <div className="flex flex-wrap gap-4 items-start">
              <PreviewCard size="lg" />
              <PreviewCard size="sm" />
            </div>
            <p className="text-[11px] text-dp-text-tertiary mt-4">
              The cropped image will be uploaded and set as the first (thumbnail) image. The original is kept.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-dp-border">
          <button type="button" onClick={onClose} disabled={applying}
            className="px-5 py-2.5 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-dp-border-hover transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => void handleApply()} disabled={applying}
            className="px-6 py-2.5 bg-dp-text-primary hover:opacity-80 disabled:opacity-50 text-dp-bg-surface text-[11px] font-bold uppercase tracking-widest rounded-sm transition-opacity">
            {applying ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  )
}

function SortableMediaItem({
  item, index, total,
  onDelete, onSetVariant, onSetThumbnail,
}: {
  item: { id?: number; src: string; media_type: string; name?: string }
  index: number
  total: number
  onDelete: () => void
  onSetVariant?: () => void
  onSetThumbnail?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id ?? `item-${index}`,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group w-20 h-16 rounded-sm overflow-hidden border border-dp-border bg-dp-bg-elevated flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing touch-none"
      aria-label="Drag image to reorder"
    >
      {item.media_type === "video" ? (
        <>
          <Play size={18} className="text-dp-text-tertiary" />
          <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-dp-text-tertiary">video</span>
        </>
      ) : (
        item.src && <Image src={item.src} alt="" fill className="object-cover" sizes="80px" />
      )}
      <span className="absolute bottom-0.5 left-0.5 text-[7px] text-white bg-black/50 px-0.5 rounded">{index + 1}</span>
      {/* Drag handle */}
      <div
        className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 pointer-events-none p-0.5 bg-black/40 rounded transition-opacity z-10"
        aria-label="Drag to reorder"
      >
        <GripVertical size={10} className="text-white" />
      </div>
      {/* Delete */}
      {item.id && (
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center transition-opacity z-10" aria-label="Delete">
          <X size={8} className="text-white" />
        </button>
      )}
      {/* Assign to variant */}
      {onSetVariant && (
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onSetVariant}
          className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 w-4 h-4 bg-dp-accent-cta rounded-full flex items-center justify-center transition-opacity z-10" aria-label="Assign to variant">
          <Check size={8} className="text-white" />
        </button>
      )}
      {/* Set thumbnail */}
      {onSetThumbnail && item.media_type !== "video" && (
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onSetThumbnail}
          className="absolute bottom-0.5 left-0.5 opacity-0 group-hover:opacity-100 w-4 h-4 bg-dp-bg-surface border border-dp-border rounded-full flex items-center justify-center transition-opacity z-10" aria-label="Set thumbnail">
          <Crop size={7} className="text-dp-text-secondary" />
        </button>
      )}
    </div>
  )
}

// ─── Processing Times CRUD Modal ─────────────────────────────────
function ProcessingTimesModal({
  vendorSlug,
  isStaff = false,
  vendors = [],
  onClose,
}: {
  vendorSlug: string
  isStaff?: boolean
  vendors?: VendorOption[]
  onClose: () => void
}) {
  const [options, setOptions] = useState<ProcessingOptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState("")
  const [newLabelKa, setNewLabelKa] = useState("")
  const [newLabelRu, setNewLabelRu] = useState("")
  const [newMin, setNewMin] = useState("")
  const [newMax, setNewMax] = useState("")
  const [newPriceGel, setNewPriceGel] = useState("")
  const [newPriceUsd, setNewPriceUsd] = useState("")
  const [newIncluded, setNewIncluded] = useState(false)
  const [newVendorSlug, setNewVendorSlug] = useState(vendorSlug)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editLabelKa, setEditLabelKa] = useState("")
  const [editLabelRu, setEditLabelRu] = useState("")
  const [editMin, setEditMin] = useState("")
  const [editMax, setEditMax] = useState("")
  const [editPriceGel, setEditPriceGel] = useState("")
  const [editPriceUsd, setEditPriceUsd] = useState("")
  const [editIncluded, setEditIncluded] = useState(false)
  const [error, setError] = useState("")

  const INPUT_CLS = "px-3 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"

  function load() {
    // Superadmin with no specific vendor: load all; vendor admin: load their own
    const url = (!isStaff && vendorSlug) ? `/admin/processing-options/?vendor=${vendorSlug}` : "/admin/processing-options/"
    adminFetch<ProcessingOptionItem[] | { results?: ProcessingOptionItem[] }>(url)
      .then((r) => {
        const list = Array.isArray(r) ? r : (r as { results?: ProcessingOptionItem[] }).results ?? []
        setOptions(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    setError("")
    const min = parseInt(newMin)
    const max = parseInt(newMax)
    if (!newLabel.trim()) { setError("Label is required."); return }
    if (isNaN(min) || isNaN(max) || min < 1 || max < min) { setError("Enter valid day range."); return }
    setAdding(true)
    try {
      await adminFetch("/admin/processing-options/", {
        method: "POST",
        body: JSON.stringify({
          label: newLabel.trim(),
          label_ka: newLabelKa.trim(),
          label_ru: newLabelRu.trim(),
          est_days_min: min,
          est_days_max: max,
          price_gel: newIncluded ? 0 : (parseFloat(newPriceGel) || 0),
          price_usd: newIncluded ? 0 : (parseFloat(newPriceUsd) || 0),
          is_included: newIncluded,
          vendor_slug: newVendorSlug || undefined,
        }),
      })
      setNewLabel(""); setNewLabelKa(""); setNewLabelRu(""); setNewMin(""); setNewMax(""); setNewPriceGel(""); setNewPriceUsd(""); setNewIncluded(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add.")
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(id: number) {
    setError("")
    const min = parseInt(editMin)
    const max = parseInt(editMax)
    if (!editLabel.trim()) { setError("Label is required."); return }
    if (isNaN(min) || isNaN(max) || min < 1 || max < min) { setError("Enter valid day range."); return }
    try {
      await adminFetch(`/admin/processing-options/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          label: editLabel.trim(),
          label_ka: editLabelKa.trim(),
          label_ru: editLabelRu.trim(),
          est_days_min: min,
          est_days_max: max,
          price_gel: editIncluded ? 0 : (parseFloat(editPriceGel) || 0),
          price_usd: editIncluded ? 0 : (parseFloat(editPriceUsd) || 0),
          is_included: editIncluded,
        }),
      })
      setEditId(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update.")
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this processing time option?")) return
    try {
      await adminFetch(`/admin/processing-options/${id}/`, { method: "DELETE" })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.")
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 overflow-y-auto py-8 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg mx-auto bg-dp-bg-surface border border-dp-border rounded-sm shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border">
          <h2 className="font-display text-xl text-dp-text-primary">Processing Times</h2>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {error && <p className="text-[12px] text-red-400">{error}</p>}

          {/* Existing options list */}
          {loading ? (
            <p className="text-[13px] text-dp-text-tertiary">Loading…</p>
          ) : options.length === 0 ? (
            <p className="text-[13px] text-dp-text-tertiary">No processing time options yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2 p-3 border border-dp-border rounded-sm bg-dp-bg-elevated">
                  {editId === opt.id ? (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex gap-2 flex-wrap items-center">
                        <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={INPUT_CLS + " flex-1 min-w-[140px]"} placeholder="Label" />
                        <input value={editLabelKa} onChange={(e) => setEditLabelKa(e.target.value)} className={INPUT_CLS + " flex-1 min-w-[140px]"} placeholder="Label (Georgian)" />
                        <input value={editLabelRu} onChange={(e) => setEditLabelRu(e.target.value)} className={INPUT_CLS + " flex-1 min-w-[140px]"} placeholder="Label (Russian)" />
                        <input value={editMin} onChange={(e) => setEditMin(e.target.value)} className={INPUT_CLS + " w-16"} type="number" placeholder="Min" />
                        <span className="text-dp-text-tertiary text-[11px]">–</span>
                        <input value={editMax} onChange={(e) => setEditMax(e.target.value)} className={INPUT_CLS + " w-16"} type="number" placeholder="Max" />
                      </div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <label className="flex items-center gap-1.5 text-[11px] text-dp-text-secondary cursor-pointer select-none">
                          <input type="checkbox" checked={editIncluded} onChange={(e) => setEditIncluded(e.target.checked)} className="accent-dp-accent-cta" />
                          Included (free)
                        </label>
                        {!editIncluded && (
                          <>
                            <input value={editPriceGel} onChange={(e) => setEditPriceGel(e.target.value)} className={INPUT_CLS + " w-28"} type="number" step="0.01" placeholder="Price ₾ (GEL)" />
                            <input value={editPriceUsd} onChange={(e) => setEditPriceUsd(e.target.value)} className={INPUT_CLS + " w-28"} type="number" step="0.01" placeholder="Price $ (USD)" />
                          </>
                        )}
                        <button onClick={() => void handleSaveEdit(opt.id)} className="px-2.5 py-1 bg-dp-accent-cta text-white text-[11px] rounded-sm hover:bg-dp-accent-cta-hover"><Check size={12} /></button>
                        <button onClick={() => setEditId(null)} className="px-2.5 py-1 border border-dp-border text-dp-text-secondary text-[11px] rounded-sm hover:border-dp-border-hover"><X size={12} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 text-left text-[13px] text-dp-text-primary">
                        <span className="font-semibold">{opt.label}</span>
                        <span className="ml-2 text-dp-text-tertiary text-[11px]">({opt.est_days_min}–{opt.est_days_max} days)</span>
                        {opt.is_included ? (
                          <span className="ml-2 px-1.5 py-0.5 bg-green-900/40 border border-green-700/50 rounded text-[9px] text-green-400">Included</span>
                        ) : (
                          <>
                            {Number(opt.price_gel) > 0 && <span className="ml-2 text-[10px] text-dp-text-tertiary">₾{Number(opt.price_gel).toFixed(2)}</span>}
                            {Number(opt.price_usd) > 0 && <span className="ml-1 text-[10px] text-dp-text-tertiary">${Number(opt.price_usd).toFixed(2)}</span>}
                          </>
                        )}
                        {isStaff && opt.vendor_slug && (
                          <span className="ml-2 px-1.5 py-0.5 bg-dp-bg-elevated border border-dp-border rounded text-[9px] text-dp-text-tertiary">
                            {opt.vendor_slug}
                          </span>
                        )}
                      </div>
                      <button onClick={() => {
                        setEditId(opt.id)
                        setEditLabel(opt.label)
                        setEditLabelKa(opt.label_ka ?? "")
                        setEditLabelRu(opt.label_ru ?? "")
                        setEditMin(String(opt.est_days_min))
                        setEditMax(String(opt.est_days_max))
                        setEditPriceGel(Number(opt.price_gel) > 0 ? String(opt.price_gel) : "")
                        setEditPriceUsd(Number(opt.price_usd) > 0 ? String(opt.price_usd) : "")
                        setEditIncluded(opt.is_included)
                      }}
                        className="p-1.5 text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => void handleDelete(opt.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 transition-colors" aria-label="Delete">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new option */}
          <div className="border-t border-dp-border pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Add New Option</p>
            <div className="flex flex-col gap-2">
              {isStaff && vendors.length > 0 && (
                <select
                  value={newVendorSlug}
                  onChange={(e) => setNewVendorSlug(e.target.value)}
                  className={INPUT_CLS + " w-full"}
                >
                  <option value="">— Global (no vendor) —</option>
                  {vendors.map((v) => (
                    <option key={v.slug} value={v.slug}>{v.name}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2 flex-wrap items-center">
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (English)" className={INPUT_CLS + " flex-1 min-w-[160px]"} />
                <input value={newLabelKa} onChange={(e) => setNewLabelKa(e.target.value)} placeholder="Label (Georgian)" className={INPUT_CLS + " flex-1 min-w-[160px]"} />
                <input value={newLabelRu} onChange={(e) => setNewLabelRu(e.target.value)} placeholder="Label (Russian)" className={INPUT_CLS + " flex-1 min-w-[160px]"} />
                <input value={newMin} onChange={(e) => setNewMin(e.target.value)} type="number" placeholder="Min days" className={INPUT_CLS + " w-24"} />
                <input value={newMax} onChange={(e) => setNewMax(e.target.value)} type="number" placeholder="Max days" className={INPUT_CLS + " w-24"} />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <label className="flex items-center gap-1.5 text-[11px] text-dp-text-secondary cursor-pointer select-none">
                  <input type="checkbox" checked={newIncluded} onChange={(e) => setNewIncluded(e.target.checked)} className="accent-dp-accent-cta" />
                  Included (free)
                </label>
                {!newIncluded && (
                  <>
                    <input value={newPriceGel} onChange={(e) => setNewPriceGel(e.target.value)} type="number" step="0.01" placeholder="Price ₾ (GEL)" className={INPUT_CLS + " w-32"} />
                    <input value={newPriceUsd} onChange={(e) => setNewPriceUsd(e.target.value)} type="number" step="0.01" placeholder="Price $ (USD)" className={INPUT_CLS + " w-32"} />
                  </>
                )}
                <button onClick={() => void handleAdd()} disabled={adding}
                  className="px-4 py-1.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors">
                  {adding ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="px-5 py-2 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-dp-border-hover transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
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
          title_ka: editProduct.title_ka ?? "", title_ru: editProduct.title_ru ?? "",
          categories: editProduct.category_slugs?.join(",") ?? editProduct.category_slug ?? "",
          tags: Array.isArray(editProduct.tags) ? editProduct.tags.join(", ") : "",
          tags_ka: Array.isArray(editProduct.tags_ka) ? editProduct.tags_ka.join(", ") : "",
          tags_ru: Array.isArray(editProduct.tags_ru) ? editProduct.tags_ru.join(", ") : "",
          vendorSlug: editProduct.vendor_slug ?? "",
          status: editProduct.status ?? "active",
          isLimited: editProduct.is_limited,
          isSale: editProduct.is_sale,
          isNew: editProduct.is_new,
          isExclusive: editProduct.is_exclusive,
          isFeatured: editProduct.is_featured ?? false,
          isReadyToShip: (editProduct as {is_ready_to_ship?: boolean}).is_ready_to_ship ?? false,
          allowCustomSize: editProduct.allow_custom_size ?? false,
          description: editProduct.description ?? "",
          description_ka: editProduct.description_ka ?? "", description_ru: editProduct.description_ru ?? "",
          material: editProduct.material ?? "",
          material_ka: editProduct.material_ka ?? "",
          material_ru: editProduct.material_ru ?? "",
          processingTimeLabel: editProduct.processing_time_label ?? "",
          processingTimeLabel_ka: editProduct.processing_time_label_ka ?? "",
          processingTimeLabel_ru: editProduct.processing_time_label_ru ?? "",
          processingOptionIds: editProduct.processing_options?.map((option) => option.id) ?? [],
          productDetails: editProduct.product_details?.join("\n") ?? "",
          productDetails_ka: editProduct.product_details_ka?.join("\n") ?? "",
          productDetails_ru: editProduct.product_details_ru?.join("\n") ?? "",
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
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [thumbnailEditorItem, setThumbnailEditorItem] = useState<{ id?: number; src: string } | null>(null)
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [newTag, setNewTag] = useState({ en: "", ka: "", ru: "" })

  // Size variants - existing (saved) and pending (to be created on save)
  const [sizeVariants, setSizeVariants] = useState<SizeVariantItem[]>(editProduct?.size_variants ?? [])
  const [pendingVariants, setPendingVariants] = useState<PendingVariant[]>([])
  const [variantImagePickerOpen, setVariantImagePickerOpen] = useState<number | null>(null)
  const emptyVariant = { label: "", labelKa: "", labelRu: "", sku: "", stock: "", priceUsd: "", priceGel: "", salePriceUsd: "", salePriceGel: "" }
  const newVarRef = useRef(emptyVariant)
  const [newVarDraft, setNewVarDraft] = useState(emptyVariant)

  // Categories
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatNameKa, setNewCatNameKa] = useState("")
  const [newCatNameRu, setNewCatNameRu] = useState("")
  const [creatingCat, setCreatingCat] = useState(false)
  const [catError, setCatError] = useState("")

  const [processingOptions, setProcessingOptions] = useState<ProcessingOptionItem[]>([])

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
          title_ka: p.title_ka ?? prev.title_ka, title_ru: p.title_ru ?? prev.title_ru,
          categories: p.category_slugs?.join(",") ?? prev.categories,
          tags: Array.isArray(p.tags) ? p.tags.join(", ") : prev.tags,
          tags_ka: Array.isArray(p.tags_ka) ? p.tags_ka.join(", ") : prev.tags_ka,
          tags_ru: Array.isArray(p.tags_ru) ? p.tags_ru.join(", ") : prev.tags_ru,
          vendorSlug: p.vendor_slug ?? prev.vendorSlug,
          status: p.status ?? prev.status,
          isLimited: p.is_limited ?? prev.isLimited,
          isSale: p.is_sale ?? prev.isSale,
          isNew: p.is_new ?? prev.isNew,
          isExclusive: p.is_exclusive ?? prev.isExclusive,
          isFeatured: p.is_featured ?? prev.isFeatured,
          isReadyToShip: (p as {is_ready_to_ship?: boolean}).is_ready_to_ship ?? prev.isReadyToShip,
          allowCustomSize: p.allow_custom_size ?? prev.allowCustomSize,
          description: p.description ?? prev.description,
          description_ka: p.description_ka ?? prev.description_ka, description_ru: p.description_ru ?? prev.description_ru,
          material: p.material ?? prev.material,
          material_ka: p.material_ka ?? prev.material_ka,
          material_ru: p.material_ru ?? prev.material_ru,
          processingTimeLabel: p.processing_time_label ?? prev.processingTimeLabel,
          processingTimeLabel_ka: p.processing_time_label_ka ?? prev.processingTimeLabel_ka,
          processingTimeLabel_ru: p.processing_time_label_ru ?? prev.processingTimeLabel_ru,
          processingOptionIds: p.processing_options?.map((option) => option.id) ?? prev.processingOptionIds,
          productDetails: p.product_details?.join("\n") ?? prev.productDetails,
          productDetails_ka: p.product_details_ka?.join("\n") ?? prev.productDetails_ka,
          productDetails_ru: p.product_details_ru?.join("\n") ?? prev.productDetails_ru,
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadProcessingOptions()
  }, [draft.vendorSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadProcessingOptions() {
    const vendorSlug = editProduct?.vendor_slug ?? draft.vendorSlug ?? ""
    // Vendor admins filter by their vendor; superadmins load all
    const ptUrl = vendorSlug
      ? `/admin/processing-options/?vendor=${vendorSlug}`
      : "/admin/processing-options/"
    adminFetch<ProcessingOptionItem[] | { results?: ProcessingOptionItem[] }>(ptUrl)
      .then((r) => {
        const list = Array.isArray(r) ? r : (r as { results?: ProcessingOptionItem[] }).results ?? []
        setProcessingOptions(list)
      })
      .catch(() => {})
  }

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
        body: JSON.stringify({ name: newCatName.trim(), name_ka: newCatNameKa.trim(), name_ru: newCatNameRu.trim(), slug }),
      })
      setCategories((prev) => [...prev, cat])
      toggleCategory(cat.slug)
      setNewCatName("")
      setNewCatNameKa("")
      setNewCatNameRu("")
      setShowNewCat(false)
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string; slug?: string[] } }
      setCatError(e?.data?.detail ?? (e?.data?.slug?.[0]) ?? "Failed to create category.")
    }
    finally { setCreatingCat(false) }
  }

  async function addPendingFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (mediaInputRef.current) mediaInputRef.current.value = ""
    if (!files.length) return

    // In edit mode, upload immediately so images are available for variant assignment right away
    if (editProduct?.id) {
      for (const file of files) {
        const isVideo = file.type.startsWith("video/")
        try {
          const uploaded = await uploadFile(editProduct.id, { file, media_type: isVideo ? "video" : "image" }) as { id: number; src?: string; url?: string; media_type?: string }
          const src = uploaded.src ?? uploaded.url ?? (isVideo ? "" : URL.createObjectURL(file))
          setMediaItems((prev) => [...prev, { id: uploaded.id, src, media_type: uploaded.media_type ?? (isVideo ? "video" : "image") }])
        } catch { /* silently fall back to pending */ }
      }
      return
    }

    // New product — queue for upload on save
    const newItems = files.map((file) => {
      const isVideo = file.type.startsWith("video/")
      return { file, preview: isVideo ? "" : URL.createObjectURL(file), media_type: isVideo ? "video" : "image" }
    })
    setPendingFiles((prev) => [...prev, ...newItems])
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

  async function handleMoveMedia(index: number, direction: "up" | "down") {
    const newItems = [...mediaItems]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return
    ;[newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]]
    await applyMediaOrder(newItems)
  }

  async function applyMediaOrder(newItems: typeof mediaItems) {
    setMediaItems(newItems)
    const payload = newItems.filter((m) => m.id).map((m, i) => ({ id: m.id!, order: i }))
    await adminFetch("/admin/products/media/reorder/", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }).catch(() => {})
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
    setNewVarDraft(emptyVariant)
  }

  function removePendingVariant(key: string) {
    setPendingVariants((prev) => prev.filter((v) => v._key !== key))
  }

  async function handleDeleteSizeVariant(id: number) {
    await adminFetch(`/admin/size-variants/${id}/`, { method: "DELETE" }).catch(() => {})
    setSizeVariants((prev) => prev.filter((sv) => sv.id !== id))
  }

  async function handleAssignVariantImages(svId: number, imageIds: number[]) {
    const res = await adminFetch(`/admin/size-variants/${svId}/`, {
      method: "PATCH",
      body: JSON.stringify({ image_ids: imageIds }),
    }).catch(() => null)
    if (res) {
      setSizeVariants((prev) => prev.map((sv) =>
        sv.id === svId
          ? { ...sv, images: mediaItems.filter((m) => m.id && imageIds.includes(m.id)) as SizeVariantItem["images"] }
          : sv,
      ))
    }
  }

  function updateSizeVariant(id: number, patch: Partial<SizeVariantItem>) {
    setSizeVariants((prev) => prev.map((variant) => variant.id === id ? { ...variant, ...patch } : variant))
  }

  function saveSizeVariant(id: number, patch: Partial<SizeVariantItem>) {
    void adminFetch<SizeVariantItem>(`/admin/size-variants/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
      .then((updated) => updateSizeVariant(id, updated))
      .catch(() => setError("Failed to update the size variant. Check that the SKU is unique."))
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
        title_ka: draft.title_ka,
        title_ru: draft.title_ru,
        base_price: firstVariantPrice,
        regional_prices: {},
        category_slug_input: catSlugs[0] ?? "",
        categories_input: catSlugs.join(","),
        vendor_slug_input: draft.vendorSlug || undefined,
        status: draft.status,
        tags: tagValues(draft.tags).filter(Boolean),
        tags_ka: tagValues(draft.tags_ka),
        tags_ru: tagValues(draft.tags_ru),
        is_limited: draft.isLimited,
        is_sale: draft.isSale,
        is_new: draft.isNew,
        is_exclusive: draft.isExclusive,
        is_featured: draft.isFeatured,
        is_ready_to_ship: draft.isReadyToShip,
        allow_custom_size: draft.allowCustomSize,
        description: draft.description,
        description_ka: draft.description_ka,
        description_ru: draft.description_ru,
        material: draft.material,
        material_ka: draft.material_ka,
        material_ru: draft.material_ru,
        processing_option_ids: draft.processingOptionIds,
        product_details: draft.productDetails.split("\n").map((line) => line.trim()).filter(Boolean),
        product_details_ka: draft.productDetails_ka.split("\n").map((line) => line.trim()).filter(Boolean),
        product_details_ru: draft.productDetails_ru.split("\n").map((line) => line.trim()).filter(Boolean),
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

      if (sizeVariants.length > 0) {
        setSavingStep(`Saving ${sizeVariants.length} size variant${sizeVariants.length > 1 ? "s" : ""}…`)
        await Promise.all(sizeVariants.map((variant) => adminFetch<SizeVariantItem>(
          `/admin/size-variants/${variant.id}/`,
          {
            method: "PATCH",
            body: JSON.stringify({
              label: variant.label,
              label_ka: variant.label_ka ?? "",
              label_ru: variant.label_ru ?? "",
              sku: variant.sku?.trim() || null,
              stock: variant.stock ?? null,
            }),
          },
        )))
      }

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
              label_ka: v.labelKa,
              label_ru: v.labelRu,
              sku: v.sku.trim() || null,
              stock: v.stock.trim() === "" ? null : parseInt(v.stock),
              price_usd: v.priceUsd,
              price_gel: v.priceGel || null,
              sale_price_usd: draft.isSale ? (v.salePriceUsd || null) : null,
              sale_price_gel: draft.isSale ? (v.salePriceGel || null) : null,
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
  function tagValues(value: string) {
    return value ? value.split(",").map((tag) => tag.trim()) : []
  }

  function addTag() {
    const english = newTag.en.trim()
    if (!english) return
    const tags = tagValues(draft.tags).filter(Boolean)
    if (tags.some((tag) => tag.toLowerCase() === english.toLowerCase())) {
      setError("This tag has already been added.")
      return
    }
    const tagsKa = tagValues(draft.tags_ka)
    const tagsRu = tagValues(draft.tags_ru)
    while (tagsKa.length < tags.length) tagsKa.push("")
    while (tagsRu.length < tags.length) tagsRu.push("")
    setDraft((current) => ({
      ...current,
      tags: [...tags, english].join(", "),
      tags_ka: [...tagsKa, newTag.ka.trim()].join(", "),
      tags_ru: [...tagsRu, newTag.ru.trim()].join(", "),
    }))
    setNewTag({ en: "", ka: "", ru: "" })
    setShowTagsModal(false)
    setError("")
  }

  function removeTag(index: number) {
    const removeAt = (value: string) => tagValues(value).filter((_, itemIndex) => itemIndex !== index).join(", ")
    setDraft((current) => ({
      ...current,
      tags: removeAt(current.tags),
      tags_ka: removeAt(current.tags_ka),
      tags_ru: removeAt(current.tags_ru),
    }))
  }

  return (
    <>
    <div className="fixed inset-0 z-50 bg-black/80 p-2 sm:p-4 flex items-center justify-center overflow-hidden" role="dialog" aria-modal="true">
      <div className="w-full max-w-7xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-dp-border bg-dp-bg-surface">
          <h2 className="font-display text-xl sm:text-2xl text-dp-text-primary">{editProduct ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary transition-colors p-1" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
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
                <label className={LABEL_CLS}>Short description</label>
                <textarea rows={10} value={draft.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="Product description shown on the product page…"
                  className={`${INPUT_CLS} resize-y`} />
              </div>
              <TranslationFields value={draft} onChange={setDraft} inputClassName={INPUT_CLS} fields={[{ key: "title_ka", label: "Title · Georgian" }, { key: "title_ru", label: "Title · Russian" }, { key: "description_ka", label: "Short description · Georgian", multiline: true }, { key: "description_ru", label: "Short description · Russian", multiline: true }]} />

              <div>
                <label className={LABEL_CLS}>Material</label>
                <input value={draft.material} onChange={(e) => set("material", e.target.value)} placeholder="e.g. Aluminium + UV ink" className={INPUT_CLS} />
              </div>
              <TranslationFields value={draft} onChange={setDraft} inputClassName={INPUT_CLS} fields={[{ key: "material_ka", label: "Material · Georgian" }, { key: "material_ru", label: "Material · Russian" }]} />

              <div>
                <label className={LABEL_CLS}>Product Details</label>
                <p className="text-[10px] text-dp-text-tertiary mb-2">Write one product detail per line.</p>
                <textarea rows={6} value={draft.productDetails} onChange={(e) => set("productDetails", e.target.value)} className={`${INPUT_CLS} resize-y`} placeholder={'Printed on 0.045" thick aluminium composite\nUV-resistant, fade-proof inks'} />
              </div>
              <TranslationFields value={draft} onChange={setDraft} inputClassName={INPUT_CLS} fields={[
                { key: "productDetails_ka", label: "Product details · Georgian", multiline: true },
                { key: "productDetails_ru", label: "Product details · Russian", multiline: true },
              ]} />

              {/* Processing time */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={LABEL_CLS + " mb-0"}>Processing Time</label>
                  <button type="button" onClick={() => setShowProcessingModal(true)}
                    className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-cta hover:underline">
                    Manage
                  </button>
                </div>
                {processingOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {processingOptions.map((opt) => (
                      <button key={opt.id} type="button"
                        onClick={() => setDraft((current) => ({ ...current,
                          processingOptionIds: current.processingOptionIds.includes(opt.id)
                            ? current.processingOptionIds.filter((id) => id !== opt.id)
                            : [...current.processingOptionIds, opt.id],
                        }))}
                        className={`px-3 py-2 rounded-sm border text-left text-[11px] font-semibold transition-colors ${
                          draft.processingOptionIds.includes(opt.id)
                            ? "border-dp-accent-cta bg-dp-accent-cta/10 text-dp-accent-cta"
                            : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"
                        }`}>
                        <span className="block">{opt.label}</span>
                        <span className="block mt-0.5 text-[9px] font-normal opacity-75">
                          {opt.est_days_min}-{opt.est_days_max} days · ${Number(opt.price_usd).toFixed(2)} / ₾{Number(opt.price_gel).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {processingOptions.length === 0 && <p className="text-[11px] text-dp-text-tertiary">Create processing options in Manage, then select them here.</p>}
              </div>

              {/* Tags as pill selector */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className={LABEL_CLS + " mb-0"}>Tags / Themes</label>
                  <button type="button" onClick={() => setShowTagsModal(true)} className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-cta hover:underline">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {tagValues(draft.tags).filter(Boolean).map((tag, index) => (
                    <span key={`${tag}-${index}`} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-dp-accent-cta bg-dp-accent-cta/10 text-[11px] font-semibold text-dp-accent-cta">
                      <span>
                        <span className="block">{tag}</span>
                        {(tagValues(draft.tags_ka)[index] || tagValues(draft.tags_ru)[index]) && (
                          <span className="block text-[9px] font-normal text-dp-text-tertiary">
                            KA: {tagValues(draft.tags_ka)[index] || "-"} · RU: {tagValues(draft.tags_ru)[index] || "-"}
                          </span>
                        )}
                      </span>
                      <button type="button" onClick={() => removeTag(index)} aria-label={`Remove ${tag}`} className="hover:text-red-400"><X size={11} /></button>
                    </span>
                  ))}
                  {!draft.tags && <span className="text-[11px] text-dp-text-tertiary">No tags added.</span>}
                </div>
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
                    { key: "isReadyToShip", label: "Ready to ship" },
                    { key: "allowCustomSize", label: "Allow custom size" },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={draft[key] as boolean} onChange={() => set(key, !draft[key])} className="w-3.5 h-3.5 accent-dp-accent-cta" />
                      <span className="text-[11px] text-dp-text-secondary">{label}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5 cursor-pointer border border-dp-accent-gold/40 bg-dp-accent-gold/10 rounded px-2 py-1">
                    <input type="checkbox" checked={draft.isFeatured} onChange={() => set("isFeatured", !draft.isFeatured)} className="w-3.5 h-3.5 accent-dp-accent-cta" />
                    <span className="text-[11px] font-semibold text-dp-accent-gold">⭐ Trending Now (homepage)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: media + categories + status */}
            <div className="flex flex-col gap-4">
              {/* Media upload */}
              <div>
                <label className={LABEL_CLS}>Images &amp; Videos</label>
                {/* Saved media — drag to reorder */}
                {mediaItems.length > 0 && (
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event
                      if (!over || active.id === over.id) return
                      const oldIdx = mediaItems.findIndex((m, i) => (m.id ?? `item-${i}`) === active.id)
                      const newIdx = mediaItems.findIndex((m, i) => (m.id ?? `item-${i}`) === over.id)
                      if (oldIdx === -1 || newIdx === -1) return
                      void applyMediaOrder(arrayMove(mediaItems, oldIdx, newIdx))
                    }}
                  >
                    <SortableContext
                      items={mediaItems.map((m, i) => m.id ?? `item-${i}`)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="flex flex-wrap gap-2 mb-2">
                        {mediaItems.map((m, i) => (
                          <SortableMediaItem
                            key={m.id ?? i}
                            item={m}
                            index={i}
                            total={mediaItems.length}
                            onDelete={() => m.id && void handleDeleteMedia(m.id)}
                            onSetThumbnail={m.media_type !== "video" ? () => setThumbnailEditorItem({ id: m.id, src: m.src }) : undefined}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input value={newCatNameKa} onChange={(e) => setNewCatNameKa(e.target.value)} placeholder="Category name (Georgian)" className={INPUT_CLS} />
                      <input value={newCatNameRu} onChange={(e) => setNewCatNameRu(e.target.value)} placeholder="Category name (Russian)" className={INPUT_CLS} />
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
                      <th className="text-left px-3 py-2 min-w-[190px]">Labels</th>
                      <th className="text-left px-3 py-2 min-w-[150px]">SKU</th>
                      <th className="text-right px-3 py-2">Other market (USD $)</th>
                      <th className="text-right px-3 py-2">Georgian market (GEL ₾)</th>
                      {draft.isSale && (
                        <>
                          <th className="text-right px-3 py-2">Sale USD $</th>
                          <th className="text-right px-3 py-2">Sale GEL ₾</th>
                        </>
                      )}
                      <th className="text-left px-3 py-2">Images</th>
                      <th className="text-right px-3 py-2">Stock</th>
                      <th className="text-center px-3 py-2">Ready</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sizeVariants.map((sv) => {
                      const assignedIds = new Set((sv.images ?? []).map((img) => img.id))
                      const isPickerOpen = variantImagePickerOpen === sv.id
                      return (
                      <tr key={sv.id} className="border-b border-dp-border last:border-0 hover:bg-dp-bg-elevated/40 transition-colors align-top">
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[12px] font-semibold text-dp-text-primary">{sv.label || "Untitled size"}</p>
                            {sv.label_ka && sv.label_ka !== sv.label && (
                              <p className="text-[10px] text-dp-text-tertiary">KA: {sv.label_ka}</p>
                            )}
                            {sv.label_ru && sv.label_ru !== sv.label && (
                              <p className="text-[10px] text-dp-text-tertiary">RU: {sv.label_ru}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input value={sv.sku ?? ""} placeholder="Auto-generated"
                            onChange={(e) => updateSizeVariant(sv.id, { sku: e.target.value })}
                            onBlur={(e) => saveSizeVariant(sv.id, { sku: e.currentTarget.value.trim() || null })}
                            className="w-full px-2 py-1 bg-dp-bg-elevated border border-dp-border rounded-sm font-mono text-[10px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover" />
                        </td>
                        <td className="px-3 py-2 text-right text-dp-text-primary">${parseFloat(sv.price_usd).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-dp-text-secondary">{sv.price_gel ? `₾${parseFloat(sv.price_gel).toFixed(2)}` : <span className="text-dp-text-tertiary">—</span>}</td>
                        {draft.isSale && (
                          <>
                            <td className="px-3 py-2 text-right text-dp-text-secondary">{sv.sale_price_usd ? `$${parseFloat(sv.sale_price_usd).toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2 text-right text-dp-text-secondary">{sv.sale_price_gel ? `₾${parseFloat(sv.sale_price_gel).toFixed(2)}` : "—"}</td>
                          </>
                        )}
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              {(sv.images ?? []).map((img) => (
                                <div key={img.id} className="relative w-8 h-8 rounded-sm overflow-hidden border border-dp-border shrink-0">
                                  {img.media_type === "video" ? <Play size={12} className="m-auto mt-1.5 text-dp-text-tertiary" /> : img.src && <Image src={img.src} alt="" fill className="object-cover" sizes="32px" />}
                                </div>
                              ))}
                              <button type="button" onClick={() => setVariantImagePickerOpen(isPickerOpen ? null : sv.id)}
                                className="text-[9px] text-dp-accent-cta hover:underline whitespace-nowrap px-1">
                                {(sv.images?.length ?? 0) > 0 ? "Edit" : "+ Assign"}
                              </button>
                            </div>
                            {isPickerOpen && mediaItems.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 p-2 border border-dp-border rounded-sm bg-dp-bg-elevated">
                                {mediaItems.filter((m) => m.id).map((m, mi) => {
                                  const selected = assignedIds.has(m.id!)
                                  return (
                                    <button key={m.id ?? mi} type="button"
                                      onClick={() => {
                                        const newIds = selected
                                          ? [...assignedIds].filter((id) => id !== m.id!)
                                          : [...assignedIds, m.id!]
                                        void handleAssignVariantImages(sv.id, newIds)
                                      }}
                                      className={`relative w-10 h-10 rounded-sm overflow-hidden border-2 transition-colors ${selected ? "border-dp-accent-cta" : "border-dp-border hover:border-dp-border-hover"}`}>
                                      {m.media_type === "video" ? <Play size={12} className="m-auto mt-2 text-dp-text-tertiary" /> : <Image src={m.src} alt="" fill className="object-cover" sizes="40px" />}
                                      {selected && <div className="absolute inset-0 bg-dp-accent-cta/20 flex items-center justify-center"><Check size={10} className="text-dp-accent-cta" /></div>}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            placeholder="∞"
                            value={(sv as {stock?: number | null}).stock ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value)
                              updateSizeVariant(sv.id, { stock: val })
                            }}
                            onBlur={(e) => saveSizeVariant(sv.id, { stock: e.currentTarget.value === "" ? null : parseInt(e.currentTarget.value) })}
                            className="w-16 px-2 py-1 bg-dp-bg-elevated border border-dp-border rounded-sm text-[11px] text-dp-text-primary text-right focus:outline-none focus:border-dp-border-hover"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={sv.is_ready_to_ship ?? false}
                            onChange={() => {
                              const next = !(sv.is_ready_to_ship ?? false)
                              updateSizeVariant(sv.id, { is_ready_to_ship: next })
                              saveSizeVariant(sv.id, { is_ready_to_ship: next })
                            }}
                            className="w-3.5 h-3.5 accent-emerald-500"
                            title="Ready to ship — pre-made item, available for fast shipping"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => void handleDeleteSizeVariant(sv.id)}
                            className="text-dp-text-tertiary hover:text-red-400 transition-colors" aria-label="Delete">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                      )
                    })}
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
                      <th className="text-left px-3 py-1.5">SKU</th>
                      <th className="text-right px-3 py-1.5">Inventory</th>
                      <th className="text-right px-3 py-1.5">USD $</th>
                      <th className="text-right px-3 py-1.5">GEL ₾</th>
                      {draft.isSale && (
                        <>
                          <th className="text-right px-3 py-1.5">Sale USD $</th>
                          <th className="text-right px-3 py-1.5">Sale GEL ₾</th>
                        </>
                      )}
                      <th className="px-3 py-1.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {pendingVariants.map((v) => (
                      <tr key={v._key} className="border-b border-dp-accent-cta/10 last:border-0">
                        <td className="px-3 py-1.5 text-dp-text-primary">
                          <span className="font-semibold">{v.label}</span>
                          {(v.labelKa || v.labelRu) && <span className="block text-[10px] text-dp-text-tertiary">{[v.labelKa, v.labelRu].filter(Boolean).join(" / ")}</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[10px] text-dp-text-secondary">{v.sku || "Auto"}</td>
                        <td className="px-3 py-1.5 text-right">{v.stock || "Unlimited"}</td>
                        <td className="px-3 py-1.5 text-right">{v.priceUsd ? `$${v.priceUsd}` : "—"}</td>
                        <td className="px-3 py-1.5 text-right">{v.priceGel ? `₾${v.priceGel}` : "—"}</td>
                        {draft.isSale && (
                          <>
                            <td className="px-3 py-1.5 text-right">{v.salePriceUsd ? `$${v.salePriceUsd}` : "—"}</td>
                            <td className="px-3 py-1.5 text-right">{v.salePriceGel ? `₾${v.salePriceGel}` : "—"}</td>
                          </>
                        )}
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
            <div className="border border-dp-border rounded-sm p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
              <div>
                <label className={LABEL_CLS}>Label *</label>
                <input value={newVarDraft.label} onChange={(e) => setNewVarDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. M / 50×70cm" className={INPUT_CLS}
                  onKeyDown={(e) => { if (e.key === "Enter") addPendingVariant() }} />
              </div>
              <div>
                <label className={LABEL_CLS}>Label · Georgian</label>
                <input value={newVarDraft.labelKa} onChange={(e) => setNewVarDraft((d) => ({ ...d, labelKa: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Label · Russian</label>
                <input value={newVarDraft.labelRu} onChange={(e) => setNewVarDraft((d) => ({ ...d, labelRu: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>SKU <span className="normal-case font-normal">(optional)</span></label>
                <input value={newVarDraft.sku} onChange={(e) => setNewVarDraft((d) => ({ ...d, sku: e.target.value }))} placeholder="Generated if blank" className={`${INPUT_CLS} font-mono`} />
              </div>
              <div>
                <label className={LABEL_CLS}>Inventory <span className="normal-case font-normal">(blank = unlimited)</span></label>
                <input type="number" min={0} value={newVarDraft.stock} onChange={(e) => setNewVarDraft((d) => ({ ...d, stock: e.target.value }))} placeholder="Unlimited" className={INPUT_CLS} />
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
              {draft.isSale && (
                <>
                  <div>
                    <label className={LABEL_CLS}>Sale other market (USD $)</label>
                    <input type="number" min={0} step={0.01} value={newVarDraft.salePriceUsd}
                      onChange={(e) => setNewVarDraft((d) => ({ ...d, salePriceUsd: e.target.value }))}
                      placeholder="0.00" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Sale Georgian market (GEL ₾)</label>
                    <input type="number" min={0} step={0.01} value={newVarDraft.salePriceGel}
                      onChange={(e) => setNewVarDraft((d) => ({ ...d, salePriceGel: e.target.value }))}
                      placeholder="0.00" className={INPUT_CLS} />
                  </div>
                </>
              )}
              <div>
                <button type="button" onClick={addPendingVariant}
                  disabled={!newVarDraft.label.trim() || !newVarDraft.priceUsd.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white text-[11px] font-bold rounded-sm transition-colors whitespace-nowrap w-full justify-center">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            <p className="text-[10px] text-dp-text-tertiary mt-1.5">Georgian storefront uses the GEL values you enter here — no conversion when GEL is set.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4 border-t border-dp-border bg-dp-bg-elevated">
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

    {thumbnailEditorItem && (
      <ThumbnailEditorModal
        image={thumbnailEditorItem}
        productId={editProduct?.id}
        onClose={() => setThumbnailEditorItem(null)}
        onApply={async (newImageId) => {
          if (newImageId) {
            // New cropped image uploaded — add it to the list and move to position 0
            const newItem = { id: newImageId, src: "", media_type: "image" }
            // Reload the product images to get the new item's src
            try {
              const detailBase2 = endpoint.endsWith("/") ? endpoint : endpoint + "/"
              const refreshed = await adminFetch<AdminProduct>(`${detailBase2}${editProduct!.id}/`)
              const newImg = refreshed.images?.find((i) => i.id === newImageId)
              if (newImg) {
                const updatedItems = [
                  { id: newImg.id, src: newImg.src ?? newImg.url, media_type: "image" },
                  ...mediaItems,
                ]
                await applyMediaOrder(updatedItems)
              }
            } catch {
              // fallback: just prepend a placeholder
              await applyMediaOrder([newItem, ...mediaItems])
            }
          } else {
            // No upload (no productId yet) — just move existing image to position 0
            const idx = mediaItems.findIndex((m) => m.id === thumbnailEditorItem.id || m.src === thumbnailEditorItem.src)
            if (idx > 0) await applyMediaOrder(arrayMove(mediaItems, idx, 0))
          }
          setThumbnailEditorItem(null)
        }}
      />
    )}
    {showProcessingModal && (
      <ProcessingTimesModal
        vendorSlug={draft.vendorSlug}
        isStaff={!isVendor}
        vendors={vendors}
        onClose={() => { setShowProcessingModal(false); loadProcessingOptions() }}
      />
    )}
    {showTagsModal && (
      <div className="fixed inset-0 z-[60] bg-black/70 p-4 flex items-center justify-center" role="dialog" aria-modal="true">
        <div className="w-full max-w-xl bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
            <div>
              <h2 className="font-display text-xl text-dp-text-primary">Add Tag / Theme</h2>
              <p className="text-[11px] text-dp-text-tertiary mt-1">Add one tag and its translations.</p>
            </div>
            <button type="button" onClick={() => setShowTagsModal(false)} aria-label="Close" className="text-dp-text-tertiary hover:text-dp-text-primary"><X size={18} /></button>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div><label className={LABEL_CLS}>English</label><input value={newTag.en} onChange={(e) => setNewTag((current) => ({ ...current, en: e.target.value }))} className={INPUT_CLS} placeholder="Anime" autoFocus /></div>
            <div><label className={LABEL_CLS}>Georgian</label><input value={newTag.ka} onChange={(e) => setNewTag((current) => ({ ...current, ka: e.target.value }))} className={INPUT_CLS} /></div>
            <div><label className={LABEL_CLS}>Russian</label><input value={newTag.ru} onChange={(e) => setNewTag((current) => ({ ...current, ru: e.target.value }))} className={INPUT_CLS} /></div>
          </div>
          <div className="flex justify-end px-5 py-4 border-t border-dp-border">
            <button type="button" onClick={() => setShowTagsModal(false)} className="px-4 py-2 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
            <button type="button" onClick={addTag} disabled={!newTag.en.trim()} className="ml-2 px-5 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-40">Add</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ─── Vendor Sale Modal ────────────────────────────────────────────
function VendorSaleModal({ vendorSlug, vendorName, onClose }: { vendorSlug: string; vendorName: string; onClose: () => void }) {
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
        `/admin/vendors/${vendorSlug}/sale/`,
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
    setSaving(true); setError("")
    try {
      await adminFetch(`/admin/vendors/${vendorSlug}/sale/`, { method: "DELETE" })
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
          <h2 className="font-display text-xl text-dp-text-primary">Run Sale — {vendorName}</h2>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {result ? (
            <div className="text-center py-6">
              <p className="text-dp-accent-cta font-semibold text-[14px]">{result}</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors">Done</button>
            </div>
          ) : (
            <>
              <div>
                <label className={LABEL_CLS}>Discount %</label>
                <input type="number" min={1} max={99} step={1} value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)} placeholder="e.g. 20" className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Apply to currency</label>
                <div className="flex gap-2">
                  {(["both", "GEL", "USD"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setCurrency(c)}
                      className={`flex-1 px-3 py-2 border rounded-sm text-[11px] font-bold uppercase tracking-widest transition-colors ${
                        currency === c ? "border-dp-accent-cta bg-dp-accent-cta/10 text-dp-accent-cta" : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"
                      }`}>
                      {c === "both" ? "Both (GEL + USD)" : c === "GEL" ? "Georgian ₾" : "Other $"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-dp-text-tertiary">
                This will set sale prices on all active size variants for <strong className="text-dp-text-secondary">{vendorName}</strong> and mark all products as on sale.
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

export default function AdminProductsPage(): React.ReactElement {
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "sold">("all")
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminProduct | null>(null)
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
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
    fetch(`${base}/admin/products/export/`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({})) as { detail?: string }
          throw new Error(err.detail ?? `Export failed (${r.status})`)
        }
        return r.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
        const a = document.createElement("a")
        a.href = url
        a.download = "products_export.xlsx"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : "Export failed.")
      })
  }

  function handleDownloadTemplate() {
    const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
    fetch(`${base}/admin/products/import/`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({})) as { detail?: string }
          throw new Error(err.detail ?? `Template download failed (${r.status})`)
        }
        return r.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
        const a = document.createElement("a")
        a.href = url
        a.download = "products_template.xlsx"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : "Template download failed.")
      })
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
      const result = await res.json().catch(() => ({})) as { created?: number; updated?: number; errors?: { row: number; error: string }[]; detail?: string }
      if (!res.ok) throw new Error(result.detail ?? `Import failed (${res.status})`)
      const errors = result.errors ?? []
      alert(`Import complete: ${result.created ?? 0} created, ${result.updated ?? 0} updated.${errors.length ? ` ${errors.length} rows need attention.` : ""}`)
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
      {showSaleModal && isVendor && adminUser?.vendor && (
        <VendorSaleModal
          vendorSlug={adminUser.vendor.slug}
          vendorName={adminUser.vendor.name}
          onClose={() => setShowSaleModal(false)}
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
            {isVendor && (
              <button onClick={() => setShowSaleModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-dp-border text-dp-text-secondary text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-dp-border-hover transition-colors">
                <Tag size={13} /> Run Sale
              </button>
            )}
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
              const prices = productCardPriceRanges(p)
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
                    <div className="mt-1 flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-dp-text-primary">
                        GEL: {prices.gel}
                      </span>
                      <span className="text-[11px] font-bold text-dp-text-primary">
                        USD: {prices.usd}
                      </span>
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
