"use client"

import React, { useCallback, useEffect, useState } from "react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"

type FilterKey = "category" | "price" | "size" | "theme" | "material" | "artist" | "availability"
type FilterVisibility = Record<FilterKey, boolean>

const FILTER_LABELS: Record<FilterKey, string> = {
  category: "Category",
  price: "Price Range",
  size: "Size",
  theme: "Theme / Collection",
  material: "Material",
  artist: "Artist",
  availability: "Availability",
}

const DEFAULT_VISIBILITY: FilterVisibility = {
  category: true,
  price: true,
  size: true,
  theme: true,
  material: true,
  artist: true,
  availability: true,
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 border-b border-dp-border last:border-b-0">
      <span className="text-[13px] font-medium text-dp-text-primary">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-dp-accent-cta" />
    </label>
  )
}

function FilterPanel({
  title,
  visibility,
  saving,
  onSave,
}: {
  title: string
  visibility: FilterVisibility
  saving: boolean
  onSave: (next: FilterVisibility) => void
}) {
  const [local, setLocal] = useState(visibility)
  useEffect(() => { setLocal(visibility) }, [visibility])

  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-dp-text-primary">{title}</h3>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(local)}
          className="px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
        <ToggleRow
          key={key}
          label={FILTER_LABELS[key]}
          checked={local[key]}
          onChange={(v) => setLocal((prev) => ({ ...prev, [key]: v }))}
        />
      ))}
    </div>
  )
}

export default function CatalogFiltersAdmin({ vendorMode = false }: { vendorMode?: boolean }): React.ReactElement {
  const [globalVis, setGlobalVis] = useState<FilterVisibility>(DEFAULT_VISIBILITY)
  const [figuresVis, setFiguresVis] = useState<FilterVisibility>(DEFAULT_VISIBILITY)
  const [wallpanelsVis, setWallpanelsVis] = useState<FilterVisibility>(DEFAULT_VISIBILITY)
  const [vendorVis, setVendorVis] = useState<FilterVisibility>(DEFAULT_VISIBILITY)
  const [saving, setSaving] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (vendorMode) {
        const data = await adminFetch<FilterVisibility>("/vendors/me/catalog-filter-config/")
        setVendorVis({ ...DEFAULT_VISIBILITY, ...data })
      } else {
        const data = await adminFetch<{ global: FilterVisibility; categories: Record<string, FilterVisibility> }>("/admin/catalog-filter-config/")
        setGlobalVis({ ...DEFAULT_VISIBILITY, ...data.global })
        setFiguresVis({ ...DEFAULT_VISIBILITY, ...(data.categories?.figures ?? {}) })
        setWallpanelsVis({ ...DEFAULT_VISIBILITY, ...(data.categories?.wallpanels ?? {}) })
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false)
    }
  }, [vendorMode])

  useEffect(() => { void load() }, [load])

  async function save(scope: string, visibility: FilterVisibility, categorySlug = "") {
    setSaving(scope)
    try {
      if (vendorMode) {
        const data = await adminFetch<FilterVisibility>("/vendors/me/catalog-filter-config/", {
          method: "PATCH",
          body: JSON.stringify({ visible_filters: visibility }),
        })
        setVendorVis({ ...DEFAULT_VISIBILITY, ...data })
      } else {
        await adminFetch("/admin/catalog-filter-config/", {
          method: "PATCH",
          body: JSON.stringify({ scope, category_slug: categorySlug, visible_filters: visibility }),
        })
        await load()
      }
    } finally {
      setSaving("")
    }
  }

  const vendor = getAdminUser()?.vendor
  const collectionLabel = vendor?.catalog_category_slug === "figures" ? "Figures" : vendor?.catalog_category_slug === "wallpanels" ? "Wallpanels" : "Collection"

  if (loading) return <p className="text-[13px] text-dp-text-tertiary p-6">Loading…</p>

  if (vendorMode) {
    return (
      <div className="p-6 md:p-8 max-w-2xl">
        <h1 className="font-display text-3xl text-dp-text-primary mb-2">Catalog Filters</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Choose which filters shoppers see on your {collectionLabel} collection page.</p>
        <FilterPanel title={`${collectionLabel} collection`} visibility={vendorVis} saving={saving === "vendor"} onSave={(v) => save("vendor", v)} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <h1 className="font-display text-3xl text-dp-text-primary mb-2">Catalog Filters</h1>
      <p className="text-[13px] text-dp-text-tertiary mb-8">Control which catalog filters are visible on the storefront. Vendor-specific overrides apply on collection pages.</p>
      <div className="grid gap-6">
        <FilterPanel title="Global catalog (/catalog)" visibility={globalVis} saving={saving === "global"} onSave={(v) => save("global", v)} />
        <FilterPanel title="Figures collection" visibility={figuresVis} saving={saving === "figures"} onSave={(v) => save("category", v, "figures")} />
        <FilterPanel title="Wallpanels collection" visibility={wallpanelsVis} saving={saving === "wallpanels"} onSave={(v) => save("category", v, "wallpanels")} />
      </div>
    </div>
  )
}
