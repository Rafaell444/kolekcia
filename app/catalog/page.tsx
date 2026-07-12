"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import ProductCard from "@/components/catalog/ProductCard"
import { SlidersHorizontal, X, ChevronDown, ChevronUp, LayoutGrid, List } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useLocale } from "@/contexts/locale-context"
import { resolveListProductPrice, formatAmount } from "@/lib/product-pricing"
import CategoryVendorBanner from "@/components/catalog/CategoryVendorBanner"

type ApiCategory = { id: string; name: string; slug: string; count: number }

type ApiProduct = {
  id: number
  slug?: string
  title: string
  artist_name: string
  artist_handle?: string
  category_slug: string
  image_url: string
  base_price: string
  original_price: string | null
  rating: string
  review_count: number
  regional_prices?: Record<string, { price?: string; original?: string | null }>
  is_limited: boolean
  is_sale: boolean
  is_new: boolean
  is_exclusive: boolean
  tags: string[]
  default_variant_id: number | null
  default_size_variant_id?: number | null
  material?: string
  size_variants?: Array<{
    id: number
    label: string
    price_usd: string
    price_gel?: string | null
    sale_price_usd?: string | null
    sale_price_gel?: string | null
    is_active?: boolean
  }>
}

type PaginatedProducts = {
  count: number
  next: string | null
  previous: string | null
  results: ApiProduct[]
}

type FilterOptions = {
  materials: string[]
  sizes: string[]
  themes: string[]
  artists: { handle: string; name: string }[]
  price_range: { min: number; max: number }
}

type FilterVisibilityKey = "category" | "price" | "size" | "theme" | "material" | "artist" | "availability"
type FilterVisibility = Record<FilterVisibilityKey, boolean>

const DEFAULT_FILTER_VISIBILITY: FilterVisibility = {
  category: true,
  price: true,
  size: true,
  theme: true,
  material: true,
  artist: true,
  availability: true,
}

// ─── Filter state type ─────────────────────────────────────
type Filters = {
  categories: string[]
  priceMin: number
  priceMax: number
  isLimited: boolean
  isSale: boolean
  isNew: boolean
  isExclusive: boolean
  materials: string[]
  sizes: string[]
  themes: string[]
  artistHandles: string[]
}

const DEFAULT_FILTERS: Filters = {
  categories: [],
  priceMin: 0,
  priceMax: 999,
  isLimited: false,
  isSale: false,
  isNew: false,
  isExclusive: false,
  materials: [],
  sizes: [],
  themes: [],
  artistHandles: [],
}

const SORT_OPTIONS = [
  { value: "trending",    label: "Trending" },
  { value: "newest",      label: "Newest" },
  { value: "bestsellers", label: "Best Sellers" },
  { value: "price_asc",   label: "Price: Low to High" },
  { value: "price_desc",  label: "Price: High to Low" },
]

// ─── Collapsible filter group (always expanded) ────────────
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-dp-border pb-4 mb-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-3">
        {title}
      </p>
      {children}
    </div>
  )
}

// ─── Price range slider ────────────────────────────────────
function PriceRangeSlider({
  absMin, absMax, min, max, currency,
  onChange,
}: {
  absMin: number; absMax: number; min: number; max: number
  currency: string
  onChange: (min: number, max: number) => void
}) {
  const step = absMax <= 100 ? 1 : absMax <= 500 ? 5 : 10
  const pct = (v: number) => absMax === absMin ? 0 : ((v - absMin) / (absMax - absMin)) * 100
  const sym = currency === "GEL" ? "₾" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$"
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

  // Local draft state so the number inputs feel responsive while typing
  const [draftMin, setDraftMin] = useState(String(min))
  const [draftMax, setDraftMax] = useState(String(max))

  // Keep drafts in sync when sliders move
  useEffect(() => { setDraftMin(String(min)) }, [min])
  useEffect(() => { setDraftMax(String(max)) }, [max])

  const commitMin = () => {
    const v = clamp(Number(draftMin) || absMin, absMin, max)
    setDraftMin(String(v))
    onChange(v, max)
  }
  const commitMax = () => {
    const v = clamp(Number(draftMax) || absMax, min, absMax)
    setDraftMax(String(v))
    onChange(min, v)
  }

  const fillLeft  = pct(min)
  const fillWidth = pct(max) - pct(min)

  return (
    <div className="px-1">
      {/* Selected range badge */}
      <div className="flex items-center justify-center gap-1.5 mb-4 bg-dp-bg-elevated rounded px-3 py-2">
        <span className="text-[11px] text-dp-text-tertiary">{sym}</span>
        <input
          type="number"
          min={absMin} max={max} step={step}
          value={draftMin}
          onChange={(e) => setDraftMin(e.target.value)}
          onBlur={commitMin}
          onKeyDown={(e) => e.key === "Enter" && commitMin()}
          className="w-12 text-[13px] font-bold text-dp-text-primary bg-transparent focus:outline-none text-center"
          aria-label="Minimum price"
        />
        <span className="text-dp-text-tertiary text-[11px]">—</span>
        <span className="text-[11px] text-dp-text-tertiary">{sym}</span>
        <input
          type="number"
          min={min} max={absMax} step={step}
          value={draftMax}
          onChange={(e) => setDraftMax(e.target.value)}
          onBlur={commitMax}
          onKeyDown={(e) => e.key === "Enter" && commitMax()}
          className="w-12 text-[13px] font-bold text-dp-text-primary bg-transparent focus:outline-none text-center"
          aria-label="Maximum price"
        />
      </div>

      {/* Shared visual track — sits between the two sliders */}
      <div className="relative h-1.5 bg-dp-bg-elevated rounded-full mx-0.5 mb-4">
        <div
          className="absolute h-full bg-dp-accent-cta rounded-full transition-all duration-75"
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
        />
      </div>

      {/* Min slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-dp-text-tertiary uppercase tracking-wide">From</span>
          <span className="text-[11px] font-semibold text-dp-text-primary">{sym}{min}</span>
        </div>
        <input
          type="range"
          min={absMin} max={absMax} step={step}
          value={min}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange(v, Math.max(v, max))
          }}
          className="w-full h-1.5 rounded-full appearance-none bg-transparent cursor-pointer accent-dp-accent-cta"
          style={{ accentColor: "var(--dp-accent-cta, #6366f1)" }}
          aria-label={`Min price: ${sym}${min}`}
        />
      </div>

      {/* Max slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-dp-text-tertiary uppercase tracking-wide">To</span>
          <span className="text-[11px] font-semibold text-dp-text-primary">{sym}{max}</span>
        </div>
        <input
          type="range"
          min={absMin} max={absMax} step={step}
          value={max}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange(Math.min(min, v), v)
          }}
          className="w-full h-1.5 rounded-full appearance-none bg-transparent cursor-pointer accent-dp-accent-cta"
          style={{ accentColor: "var(--dp-accent-cta, #6366f1)" }}
          aria-label={`Max price: ${sym}${max}`}
        />
      </div>

      {/* Absolute range labels */}
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-dp-text-tertiary">{sym}{absMin}</span>
        <span className="text-[10px] text-dp-text-tertiary">{sym}{absMax}</span>
      </div>
    </div>
  )
}

function filtersForPage(lockedCategory: string): Filters {
  return {
    ...DEFAULT_FILTERS,
    categories: lockedCategory ? [lockedCategory] : [],
  }
}

// ─── Filter sidebar ────────────────────────────────────────
function FilterSidebar({
  filters,
  onChange,
  onReset,
  categories,
  filterOptions,
  hideCategoryFilter = false,
  currency,
  filterVisibility = DEFAULT_FILTER_VISIBILITY,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  onReset: () => void
  categories: ApiCategory[]
  filterOptions: FilterOptions | null
  hideCategoryFilter?: boolean
  currency: string
  filterVisibility?: FilterVisibility
}) {
  const toggleArr = (key: "categories" | "materials" | "sizes" | "themes" | "artistHandles", value: string) => {
    const arr = filters[key]
    onChange({
      ...filters,
      [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    })
  }

  const absMin = Math.floor((filterOptions?.price_range.min ?? 0))
  const absMax = Math.ceil((filterOptions?.price_range.max ?? 250) / 10) * 10

  const activeCount =
    (hideCategoryFilter ? 0 : filters.categories.length) +
    (filters.isLimited ? 1 : 0) +
    (filters.isSale ? 1 : 0) +
    (filters.isNew ? 1 : 0) +
    (filters.isExclusive ? 1 : 0) +
    (filters.priceMin > absMin ? 1 : 0) +
    (filters.priceMax < absMax ? 1 : 0) +
    filters.materials.length +
    filters.sizes.length +
    filters.themes.length +
    filters.artistHandles.length

  return (
    <aside className="w-full lg:w-56 xl:w-64 shrink-0" aria-label="Product filters">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-dp-text-primary uppercase tracking-widest">
          <SlidersHorizontal size={14} />
          Filters
          {activeCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-dp-accent-cta text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="text-[11px] text-dp-text-tertiary hover:text-dp-accent-cta transition-colors flex items-center gap-1"
          >
            <X size={11} /> Clear all
          </button>
        )}
      </div>

      {/* Category — hidden on locked category pages */}
      {filterVisibility.category && !hideCategoryFilter && categories.length > 0 && (
        <FilterGroup title="Category">
          <ul className="flex flex-col gap-1.5">
            {categories.map((cat) => {
              const active = filters.categories.includes(cat.slug)
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => toggleArr("categories", cat.slug)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[13px] transition-colors ${
                      active
                        ? "bg-dp-accent-cta/10 text-dp-accent-cta font-semibold"
                        : "text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className={`text-[11px] ${active ? "text-dp-accent-cta" : "text-dp-text-tertiary"}`}>{cat.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </FilterGroup>
      )}

      {/* Price Range */}
      {filterVisibility.price && filterOptions && (
        <FilterGroup title="Price Range">
          <PriceRangeSlider
            absMin={absMin}
            absMax={absMax}
            min={Math.max(filters.priceMin, absMin)}
            max={Math.min(filters.priceMax < 999 ? filters.priceMax : absMax, absMax)}
            currency={currency}
            onChange={(lo, hi) => onChange({ ...filters, priceMin: lo, priceMax: hi })}
          />
        </FilterGroup>
      )}

      {/* Size */}
      {filterVisibility.size && filterOptions && filterOptions.sizes.length > 0 && (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-2">
            {filterOptions.sizes.map((sz) => {
              const active = filters.sizes.includes(sz)
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => toggleArr("sizes", sz)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                    active
                      ? "bg-dp-accent-cta text-white border-dp-accent-cta"
                      : "border-dp-border text-dp-text-secondary hover:border-dp-accent-cta hover:text-dp-accent-cta"
                  }`}
                >
                  {sz}
                </button>
              )
            })}
          </div>
        </FilterGroup>
      )}

      {/* Themes — derived from product tags (Forest, Nature, Cyberpunk, etc.) */}
      {filterVisibility.theme && filterOptions && filterOptions.themes.length > 0 && (
        <FilterGroup title="Theme / Collection">
          <div className="flex flex-wrap gap-2">
            {filterOptions.themes.map((theme) => {
              const active = filters.themes.includes(theme)
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => toggleArr("themes", theme)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                    active
                      ? "bg-dp-accent-cta text-white border-dp-accent-cta"
                      : "border-dp-border text-dp-text-secondary hover:border-dp-accent-cta hover:text-dp-accent-cta"
                  }`}
                >
                  {theme}
                </button>
              )
            })}
          </div>
        </FilterGroup>
      )}

      {/* Material */}
      {filterVisibility.material && filterOptions && filterOptions.materials.length > 0 && (
        <FilterGroup title="Material">
          <ul className="flex flex-col gap-1.5">
            {filterOptions.materials.map((mat) => (
              <li key={mat}>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.materials.includes(mat)}
                    onChange={() => toggleArr("materials", mat)}
                    className="w-3.5 h-3.5 accent-dp-accent-cta shrink-0"
                  />
                  <span className="text-[12px] text-dp-text-secondary group-hover:text-dp-text-primary transition-colors leading-tight">
                    {mat}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </FilterGroup>
      )}

      {/* Artist */}
      {filterVisibility.artist && filterOptions && filterOptions.artists.length > 1 && (
        <FilterGroup title="Artist">
          <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {filterOptions.artists.map((a) => {
              const active = filters.artistHandles.includes(a.handle)
              return (
                <li key={a.handle}>
                  <button
                    type="button"
                    onClick={() => toggleArr("artistHandles", a.handle)}
                    className={`w-full flex items-center px-2.5 py-1.5 rounded text-[13px] transition-colors ${
                      active
                        ? "bg-dp-accent-cta/10 text-dp-accent-cta font-semibold"
                        : "text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated"
                    }`}
                  >
                    {a.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </FilterGroup>
      )}

      {/* Availability */}
      {filterVisibility.availability && (
      <FilterGroup title="Availability">
        {(
          [
            { key: "isLimited",   label: "Limited Edition" },
            { key: "isSale",      label: "On Sale" },
            { key: "isNew",       label: "New Arrivals" },
            { key: "isExclusive", label: "Exclusive" },
          ] as const
        ).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2.5 mb-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters[key] as boolean}
              onChange={() => onChange({ ...filters, [key]: !filters[key] })}
              className="w-3.5 h-3.5 accent-dp-accent-cta"
            />
            <span className="text-[13px] text-dp-text-secondary group-hover:text-dp-text-primary transition-colors">
              {label}
            </span>
          </label>
        ))}
      </FilterGroup>
      )}
    </aside>
  )
}

// ─── Skeleton grid ─────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[3/4] bg-dp-bg-elevated rounded-sm mb-3" />
      <div className="h-3 bg-dp-bg-elevated rounded w-3/4 mb-2" />
      <div className="h-3 bg-dp-bg-elevated rounded w-1/2" />
    </div>
  )
}

const SORT_MAP: Record<string, string> = {
  trending:    "featured",
  newest:      "newest",
  bestsellers: "featured",
  price_asc:   "price-low",
  price_desc:  "price-high",
}

const CATEGORY_VENDOR_SLUGS = new Set(["figures", "wallpanels"])

function catalogHeading(category: string, search: string): string {
  if (search) return `Results for "${search}"`
  if (category === "figures") return "All Figure Designs"
  if (category === "wallpanels") return "All Wallpanel Designs"
  return "All Designs"
}

// ─── Page ──────────────────────────────────────────────────
function CatalogPageInner(): React.ReactElement {
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") ?? ""
  const urlCategory = searchParams.get("category") ?? ""
  const { currency, rates } = useLocale()
  const lockedCategory = CATEGORY_VENDOR_SLUGS.has(urlCategory) ? urlCategory : ""
  const hideCategoryFilter = Boolean(lockedCategory)

  const [filters, setFilters]   = useState<Filters>(() => filtersForPage(lockedCategory))
  const [sort, setSort]         = useState("trending")
  const [view, setView]         = useState<"grid" | "list">("grid")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [filterVisibility, setFilterVisibility] = useState<FilterVisibility>(DEFAULT_FILTER_VISIBILITY)

  const [products, setProducts] = useState<ApiProduct[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [mobileOpen])

  useEffect(() => {
    let cancelled = false
    apiFetch<ApiCategory[]>("/products/categories/").then((d) => { if (!cancelled) setCategories(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch filter options (materials, artists, price range) for current context
  useEffect(() => {
    let cancelled = false
    const qs = lockedCategory ? `?category=${lockedCategory}` : ""
    apiFetch<FilterOptions>(`/products/filter-options/${qs}`)
      .then((d) => {
        if (!cancelled) {
          setFilterOptions(d)
          // Initialise price bounds to the real data range on first load
          const realMin = Math.floor(d.price_range.min)
          const realMax = Math.ceil(d.price_range.max / 10) * 10
          setFilters((prev) => ({
            ...prev,
            priceMin: prev.priceMin === 0 ? realMin : prev.priceMin,
            priceMax: prev.priceMax === 999 ? realMax : prev.priceMax,
          }))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [lockedCategory])

  useEffect(() => {
    let cancelled = false
    const qs = lockedCategory ? `?category=${lockedCategory}` : ""
    apiFetch<FilterVisibility>(`/products/catalog-filter-config${qs}`)
      .then((d) => { if (!cancelled && d) setFilterVisibility({ ...DEFAULT_FILTER_VISIBILITY, ...d }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [lockedCategory])

  useEffect(() => {
    setFilters((prev) => {
      if (lockedCategory) {
        if (prev.categories.length === 1 && prev.categories[0] === lockedCategory) return prev
        return { ...prev, categories: [lockedCategory] }
      }
      const nextCategories = urlCategory ? [urlCategory] : []
      if (prev.categories.join(",") === nextCategories.join(",")) return prev
      return { ...prev, categories: nextCategories }
    })
  }, [urlCategory, lockedCategory])

  const resetFilters = useCallback(() => {
    setFilters((prev) => ({
      ...filtersForPage(lockedCategory),
      priceMin: filterOptions ? Math.floor(filterOptions.price_range.min) : 0,
      priceMax: filterOptions ? Math.ceil(filterOptions.price_range.max / 10) * 10 : prev.priceMax,
    }))
  }, [lockedCategory, filterOptions])

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()
    if (urlSearch) params.set("search", urlSearch)
    const effectiveCategory = lockedCategory || (filters.categories.length === 1 ? filters.categories[0] : "")
    if (effectiveCategory) params.set("category", effectiveCategory)
    const absMin = filterOptions ? Math.floor(filterOptions.price_range.min) : 0
    const absMax = filterOptions ? Math.ceil(filterOptions.price_range.max / 10) * 10 : 999
    if (filters.priceMin > absMin) params.set("min_price", String(filters.priceMin))
    if (filters.priceMax < absMax && filters.priceMax < 999) params.set("max_price", String(filters.priceMax))
    if (filters.isLimited) params.set("limited", "true")
    if (filters.isSale) params.set("sale", "true")
    if (filters.isNew) params.set("new", "true")
    if (filters.isExclusive) params.set("exclusive", "true")
    if (filters.materials.length > 0) params.set("material", filters.materials.join(","))
    if (filters.sizes.length > 0) params.set("size", filters.sizes.join(","))
    if (filters.themes.length > 0) params.set("tag", filters.themes.join(","))
    if (filters.artistHandles.length > 0) params.set("artist", filters.artistHandles.join(","))
    params.set("sort", SORT_MAP[sort] ?? "featured")
    params.set("page", String(page))
    return params.toString()
  }, [filters, sort, page, urlSearch, lockedCategory, filterOptions])

  useEffect(() => {
    let cancelled = false
    if (abortRef.current) abortRef.current.abort()

    const fetchProducts = async (attempt = 0) => {
      if (cancelled) return
      setFetchLoading(true)
      try {
        const qs = buildQueryString()
        const data = await apiFetch<PaginatedProducts>(`/products/?${qs}`)
        if (!cancelled) {
          setProducts(data.results)
          setTotalCount(data.count)
          setHasNext(!!data.next)
        }
      } catch {
        if (!cancelled && attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000))
          fetchProducts(attempt + 1)
          return
        }
      } finally {
        if (!cancelled) setFetchLoading(false)
      }
    }

    fetchProducts()
    return () => { cancelled = true }
  }, [buildQueryString])

  // Reset page on filter/sort change
  useEffect(() => { setPage(1) }, [filters, sort])

  return (
    <SiteShell>
      {CATEGORY_VENDOR_SLUGS.has(urlCategory) && (
        <CategoryVendorBanner categorySlug={urlCategory} />
      )}

      {/* ── Page header (compact when vendor hero is shown) ── */}
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className={`dp-container ${CATEGORY_VENDOR_SLUGS.has(urlCategory) ? "py-4 sm:py-5" : "py-6"}`}>
          <h1 className={`font-display text-dp-text-primary ${CATEGORY_VENDOR_SLUGS.has(urlCategory) ? "text-2xl sm:text-3xl md:text-4xl" : "text-4xl md:text-5xl"}`}>
            {catalogHeading(urlCategory, urlSearch)}
          </h1>
          <p className="text-dp-text-secondary text-sm mt-1">
            {fetchLoading ? "Loading…" : `${totalCount.toLocaleString()} results`}
          </p>
        </div>
      </div>

      <div className="dp-container py-8">
        {/* ── Mobile filter toggle ── */}
        <div className="flex items-center justify-between gap-3 mb-5 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-dp-border rounded-sm text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="flex-1 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary px-3 py-2 focus:outline-none focus:border-dp-border-hover"
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-8">
          {/* ── Desktop sidebar ── */}
          <div className="hidden lg:block">
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              onReset={resetFilters}
              categories={categories}
              filterOptions={filterOptions}
              hideCategoryFilter={hideCategoryFilter}
              currency={currency}
              filterVisibility={filterVisibility}
            />
          </div>

          {/* ── Product grid ── */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="hidden lg:flex items-center justify-between mb-5">
              <span className="text-[13px] text-dp-text-secondary">
                {totalCount} results for{" "}
                <strong className="text-dp-text-primary">{catalogHeading(urlCategory, urlSearch)}</strong>
              </span>
              <div className="flex items-center gap-3">
                {/* Sort */}
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="appearance-none bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary pl-3 pr-8 py-2 focus:outline-none focus:border-dp-border-hover cursor-pointer"
                    aria-label="Sort products"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dp-text-tertiary pointer-events-none" />
                </div>
                {/* View toggle */}
                <div className="flex border border-dp-border rounded-sm overflow-hidden">
                  <button
                    onClick={() => setView("grid")}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    className={`p-2 transition-colors ${view === "grid" ? "bg-dp-bg-elevated text-dp-text-primary" : "text-dp-text-tertiary hover:text-dp-text-secondary"}`}
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    onClick={() => setView("list")}
                    aria-label="List view"
                    aria-pressed={view === "list"}
                    className={`p-2 transition-colors ${view === "list" ? "bg-dp-bg-elevated text-dp-text-primary" : "text-dp-text-tertiary hover:text-dp-text-secondary"}`}
                  >
                    <List size={14} />
                  </button>
                </div>
              </div>
            </div>

            {fetchLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="font-display text-3xl text-dp-text-primary mb-2">No results</p>
                <p className="text-dp-text-tertiary text-sm mb-4">Try adjusting your filters.</p>
                <button
                  onClick={resetFilters}
                  className="px-5 py-2 border border-dp-border text-dp-text-secondary hover:text-dp-text-primary rounded-sm text-[12px] font-semibold uppercase tracking-widest transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => {
                  const resolved = resolveListProductPrice(p, currency, rates)
                  return (
                  <ProductCard key={p.id} product={{
                    id: String(p.id), title: p.title, artistName: p.artist_name,
                    slug: p.slug,
                    category: p.category_slug,
                    imageUrl: p.image_url, price: resolved.price,
                    originalPrice: resolved.original,
                    isLimited: p.is_limited, isSale: p.is_sale, isNew: p.is_new,
                    isExclusive: p.is_exclusive, tags: p.tags,
                    defaultVariantId: p.default_variant_id,
                    defaultSizeVariantId: p.default_size_variant_id ?? p.size_variants?.find((sv) => sv.is_active !== false)?.id ?? null,
                    priceIsLocalized: true,
                  }} />
                )})}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {products.map((p) => {
                  const resolved = resolveListProductPrice(p, currency, rates)
                  return (
                  <div key={p.id} className="flex gap-4 bg-dp-bg-surface border border-dp-border rounded-sm p-3 dp-card-hover">
                    <div className="relative w-20 h-28 shrink-0 overflow-hidden rounded-sm">
                      <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col justify-between py-1 flex-1 min-w-0">
                      <div>
                        <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">{p.artist_name}</p>
                        <p className="text-[14px] font-semibold text-dp-text-primary mt-0.5">{p.title}</p>
                        <p className="text-[12px] text-dp-text-secondary mt-1">{p.tags.join(" · ")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-dp-text-primary">{formatAmount(resolved.price, currency)}</span>
                        {resolved.original != null && (
                          <span className="text-[12px] text-dp-text-tertiary line-through">{formatAmount(resolved.original, currency)}</span>
                        )}
                        {p.is_limited && <span className="badge-limited">Limited</span>}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
            {/* Pagination */}
            {!fetchLoading && (hasNext || page > 1) && (
              <div className="flex items-center justify-center gap-3 mt-8">
                {page > 1 && (
                  <button onClick={() => setPage((p) => p - 1)} className="px-5 py-2 border border-dp-border rounded-sm text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
                    Previous
                  </button>
                )}
                <span className="text-[12px] text-dp-text-tertiary">Page {page}</span>
                {hasNext && (
                  <button onClick={() => setPage((p) => p + 1)} className="px-5 py-2 border border-dp-border rounded-sm text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
                    Next
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filter drawer ── */}
      {mounted && mobileOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[200] bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="fixed inset-0 z-[201] bg-dp-bg-surface flex flex-col lg:hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border shrink-0">
              <span className="font-display text-2xl text-dp-text-primary">Filters</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close filters">
                <X size={20} className="text-dp-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                onReset={() => { resetFilters(); setMobileOpen(false) }}
                categories={categories}
                filterOptions={filterOptions}
                hideCategoryFilter={hideCategoryFilter}
                currency={currency}
                filterVisibility={filterVisibility}
              />
            </div>
            <div className="shrink-0 px-5 py-4 border-t border-dp-border bg-dp-bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full py-3 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors"
              >
                Show {totalCount} Results
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </SiteShell>
  )
}

export default function CatalogPage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <CatalogPageInner />
    </Suspense>
  )
}
