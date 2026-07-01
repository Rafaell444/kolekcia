"use client"

import React, { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { productHref } from "@/lib/product-url"
import { useLocale } from "@/contexts/locale-context"

export type SearchProduct = {
  id: number
  slug?: string
  category_slug?: string
  title: string
  artist_name: string
  base_price: string
  image_url: string
}

function useProductSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchProduct[]>([])
  const [busy, setBusy] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    timerRef.current = setTimeout(async () => {
      setBusy(true)
      try {
        const data = await apiFetch<{ results: SearchProduct[] }>(
          `/products/?search=${encodeURIComponent(q)}&page_size=6`
        )
        setResults(data.results)
      } catch {
        setResults([])
      } finally {
        setBusy(false)
      }
    }, 280)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  function reset() {
    setQuery("")
    setResults([])
  }

  return { query, setQuery, results, busy, reset }
}

function SearchResults({
  results,
  busy,
  query,
  onSelect,
  onSeeAll,
  className = "",
}: {
  results: SearchProduct[]
  busy: boolean
  query: string
  onSelect: (p: SearchProduct) => void
  onSeeAll: () => void
  className?: string
}) {
  const { formatPrice } = useLocale()
  const q = query.trim()

  if (!q) return null

  if (busy && results.length === 0) {
    return (
      <div className={`px-4 py-3 text-[12px] text-dp-text-tertiary flex items-center gap-2 ${className}`}>
        <Loader2 size={12} className="animate-spin" /> Searching…
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className={`px-4 py-3 text-[12px] text-dp-text-tertiary ${className}`}>
        No results for &ldquo;{q}&rdquo;
      </div>
    )
  }

  return (
    <div className={className}>
      <ul>
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-dp-bg-elevated transition-colors text-left"
            >
              <div className="w-9 h-12 shrink-0 rounded-sm overflow-hidden bg-dp-bg-elevated border border-dp-border">
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-dp-text-primary truncate">{r.title}</p>
                <p className="text-[11px] text-dp-text-tertiary truncate">{r.artist_name}</p>
              </div>
              <p className="text-[13px] font-bold text-dp-text-primary shrink-0">
                {formatPrice(parseFloat(r.base_price))}
              </p>
            </button>
          </li>
        ))}
      </ul>
      <div className="px-3 py-2 border-t border-dp-border">
        <button
          type="button"
          onClick={onSeeAll}
          className="text-[11px] font-semibold text-dp-accent-cta hover:underline"
        >
          See all results for &ldquo;{q}&rdquo; →
        </button>
      </div>
    </div>
  )
}

/** Inline search for the burger menu sidebar. */
export function MenuSearch({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  const { query, setQuery, results, busy, reset } = useProductSearch()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [])

  function go(product: SearchProduct) {
    reset()
    onClose?.()
    router.push(productHref({ id: product.id, slug: product.slug, categorySlug: product.category_slug }))
  }

  function seeAll() {
    const q = query.trim()
    if (!q) return
    reset()
    onClose?.()
    router.push(`/catalog?search=${encodeURIComponent(q)}`)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) seeAll()
  }

  return (
    <div className="pt-3 border-t border-dp-border mt-2">
      <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-2 px-1">Search</p>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm">
        <Search size={14} className="text-dp-text-tertiary shrink-0" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search designs…"
          className="flex-1 bg-transparent text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary outline-none min-w-0"
          aria-label="Search designs"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={reset}
            className="text-dp-text-tertiary hover:text-dp-text-primary"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {(results.length > 0 || busy || query.trim()) && (
        <div className="mt-2 border border-dp-border rounded-sm bg-dp-bg-elevated overflow-hidden max-h-64 overflow-y-auto">
          <SearchResults
            results={results}
            busy={busy}
            query={query}
            onSelect={go}
            onSeeAll={seeAll}
          />
        </div>
      )}
    </div>
  )
}

/** Desktop header search — expands inline in the nav bar. */
export function DesktopSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { query, setQuery, results, busy, reset } = useProductSearch()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function close() {
    setOpen(false)
    reset()
  }

  function openSearch() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function go(product: SearchProduct) {
    close()
    router.push(productHref({ id: product.id, slug: product.slug, categorySlug: product.category_slug }))
  }

  function seeAll() {
    const q = query.trim()
    if (!q) return
    close()
    router.push(`/catalog?search=${encodeURIComponent(q)}`)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") close()
    if (e.key === "Enter" && query.trim()) seeAll()
  }

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      {open ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-dp-bg-elevated border border-dp-accent-cta/60 rounded-sm min-w-[220px] lg:min-w-[280px]">
          <Search size={13} className="text-dp-text-tertiary shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search designs…"
            className="flex-1 bg-transparent text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary outline-none"
            aria-label="Search designs"
            autoComplete="off"
          />
          {busy && <Loader2 size={12} className="animate-spin text-dp-text-tertiary shrink-0" />}
          <button type="button" onClick={close} className="shrink-0 text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Close search">
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openSearch}
          className="flex items-center gap-2 px-3 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
          aria-label="Open search"
        >
          <Search size={13} aria-hidden />
          <span className="hidden lg:block">Search…</span>
        </button>
      )}

      {open && (results.length > 0 || busy || query.trim()) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl z-50 overflow-hidden min-w-[320px]">
          <SearchResults results={results} busy={busy} query={query} onSelect={go} onSeeAll={seeAll} />
        </div>
      )}
    </div>
  )
}

/** Mobile header search — opens a top sheet overlay (only when burger menu is closed). */
export function MobileHeaderSearch({ hidden }: { hidden?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { query, setQuery, results, busy, reset } = useProductSearch()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => {
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  function close() {
    setOpen(false)
    reset()
  }

  function go(product: SearchProduct) {
    close()
    router.push(productHref({ id: product.id, slug: product.slug, categorySlug: product.category_slug }))
  }

  function seeAll() {
    const q = query.trim()
    if (!q) return
    close()
    router.push(`/catalog?search=${encodeURIComponent(q)}`)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") close()
    if (e.key === "Enter" && query.trim()) seeAll()
  }

  if (hidden) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
        aria-label="Open search"
      >
        <Search size={15} aria-hidden />
      </button>

      {open && (
        <div className="md:hidden fixed inset-x-0 top-0 bottom-16 z-[110] flex flex-col bg-dp-bg-surface">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-dp-border shrink-0">
            <Search size={16} className="text-dp-text-tertiary shrink-0" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search designs…"
              className="flex-1 bg-transparent text-[15px] text-dp-text-primary placeholder:text-dp-text-tertiary outline-none min-w-0"
              aria-label="Search designs"
              autoComplete="off"
            />
            {busy && <Loader2 size={14} className="animate-spin text-dp-text-tertiary shrink-0" />}
            <button
              type="button"
              onClick={close}
              className="flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-secondary hover:text-dp-text-primary shrink-0"
              aria-label="Close search"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SearchResults
              results={results}
              busy={busy}
              query={query}
              onSelect={go}
              onSeeAll={seeAll}
              className="py-1"
            />
          </div>
        </div>
      )}
    </>
  )
}
