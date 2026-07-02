"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import ProductCard from "@/components/catalog/ProductCard"
import { SlidersHorizontal, X, ChevronDown, ChevronUp, LayoutGrid, List } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useLocale } from "@/contexts/locale-context"
import { resolveProductPrices, formatAmount } from "@/lib/product-pricing"
import CategoryVendorBanner from "@/components/catalog/CategoryVendorBanner"

type ApiCategory = { id: string; name: string; slug: string; count: number }

type ApiProduct = {
  id: number
  slug?: string
  title: string
  artist_name: string
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
}

type PaginatedProducts = {
  count: number
  next: string | null
  previous: string | null
  results: ApiProduct[]
}

// ─── Filter state type ─────────────────────────────────────
type Filters = {
  categories: string[]
  priceMax: number
  isLimited: boolean
  isSale: boolean
  isNew: boolean
  isExclusive: boolean
}

const DEFAULT_FILTERS: Filters = {
  categories: [],
  priceMax: 100,
  isLimited: false,
  isSale: false,
  isNew: false,
  isExclusive: false,
}

const SORT_OPTIONS = [
  { value: "trending",    label: "Trending" },
  { value: "newest",      label: "Newest" },
  { value: "bestsellers", label: "Best Sellers" },
  { value: "price_asc",   label: "Price: Low to High" },
  { value: "price_desc",  label: "Price: High to Low" },
  { value: "rating",      label: "Top Rated" },
]

// ─── Collapsible filter group ──────────────────────────────
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-dp-border pb-4 mb-4">
      <button
        className="flex items-center justify-between w-full text-left mb-3"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary">
          {title}
        </span>
        {open
          ? <ChevronUp size={14} className="text-dp-text-tertiary" />
          : <ChevronDown size={14} className="text-dp-text-tertiary" />
        }
      </button>
      {open && children}
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
  hideCategoryFilter = false,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  onReset: () => void
  categories: ApiCategory[]
  hideCategoryFilter?: boolean
}) {
  const toggle = (key: keyof Filters, value: string) => {
    const arr = filters[key] as string[]
    onChange({
      ...filters,
      [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    })
  }

  const activeCount =
    (hideCategoryFilter ? 0 : filters.categories.length) +
    (filters.isLimited ? 1 : 0) +
    (filters.isSale ? 1 : 0) +
    (filters.isNew ? 1 : 0) +
    (filters.isExclusive ? 1 : 0) +
    (filters.priceMax < 100 ? 1 : 0)

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

      {/* Category */}
      {!hideCategoryFilter && (
      <FilterGroup title="Category">
        <ul className="flex flex-col gap-1.5">
          {categories.map((cat) => (
            <li key={cat.id}>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(cat.slug)}
                  onChange={() => toggle("categories", cat.slug)}
                  className="w-3.5 h-3.5 accent-dp-accent-cta"
                />
                <span className="text-[13px] text-dp-text-secondary group-hover:text-dp-text-primary transition-colors">
                  {cat.name}
                </span>
                <span className="ml-auto text-[11px] text-dp-text-tertiary">
                  {cat.count}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </FilterGroup>
      )}

      {/* Price */}
      <FilterGroup title="Max Price">
        <div className="px-1">
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={filters.priceMax}
            onChange={(e) => onChange({ ...filters, priceMax: Number(e.target.value) })}
            className="w-full accent-dp-accent-cta"
            aria-label={`Max price: $${filters.priceMax}`}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-dp-text-tertiary">$10</span>
            <span className="text-[12px] font-bold text-dp-text-primary">${filters.priceMax}</span>
            <span className="text-[11px] text-dp-text-tertiary">$100</span>
          </div>
        </div>
      </FilterGroup>

      {/* Availability */}
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
  rating:      "featured",
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

  const [products, setProducts] = useState<ApiProduct[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<ApiCategory[]>("/products/categories/").then((d) => { if (!cancelled) setCategories(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

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
    setFilters(filtersForPage(lockedCategory))
  }, [lockedCategory])

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()
    if (urlSearch) params.set("search", urlSearch)
    const effectiveCategory = lockedCategory || (filters.categories.length === 1 ? filters.categories[0] : "")
    if (effectiveCategory) params.set("category", effectiveCategory)
    if (filters.priceMax < 100) params.set("max_price", String(filters.priceMax))
    if (filters.isLimited) params.set("limited", "true")
    if (filters.isSale) params.set("sale", "true")
    if (filters.isNew) params.set("new", "true")
    if (filters.isExclusive) params.set("exclusive", "true")
    params.set("sort", SORT_MAP[sort] ?? "featured")
    params.set("page", String(page))
    return params.toString()
  }, [filters, sort, page, urlSearch, lockedCategory])

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

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort"

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
              hideCategoryFilter={hideCategoryFilter}
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
                  const resolved = resolveProductPrices(p.base_price, p.original_price, p.regional_prices, currency, rates)
                  return (
                  <ProductCard key={p.id} product={{
                    id: String(p.id), title: p.title, artistName: p.artist_name,
                    slug: p.slug,
                    category: p.category_slug,
                    imageUrl: p.image_url, price: resolved.price,
                    originalPrice: resolved.original,
                    rating: parseFloat(p.rating), reviews: p.review_count,
                    isLimited: p.is_limited, isSale: p.is_sale, isNew: p.is_new,
                    isExclusive: p.is_exclusive, tags: p.tags,
                    defaultVariantId: p.default_variant_id,
                    priceIsLocalized: true,
                  }} />
                )})}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {products.map((p) => {
                  const resolved = resolveProductPrices(p.base_price, p.original_price, p.regional_prices, currency, rates)
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
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-full bg-dp-bg-surface border-r border-dp-border overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-5">
              <span className="font-display text-2xl text-dp-text-primary">Filters</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close filters">
                <X size={20} className="text-dp-text-secondary" />
              </button>
            </div>
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              onReset={() => { resetFilters(); setMobileOpen(false) }}
              categories={categories}
              hideCategoryFilter={hideCategoryFilter}
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="w-full mt-4 py-3 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors"
            >
              Show {totalCount} Results
            </button>
          </div>
        </>
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
