"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import ProductCard from "@/components/catalog/ProductCard"
import {
  Search, MessageSquare, CheckCircle, Star, Palette, Users,
  X, Send, SlidersHorizontal, Loader2,
} from "lucide-react"
import { apiFetch, authFetch } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"

// ─── Types ──────────────────────────────────────────────────

type Artist = {
  id: number
  name: string
  handle: string
  avatar_url: string
  cover_url: string
  bio: string
  designs: number
  followers: number
  level: number
  badge: string
  verified: boolean
  vendor_id: number | null
  vendor_slug: string | null
  vendor_name: string | null
}

type ApiProduct = {
  id: number
  title: string
  artist_name: string
  category_slug: string
  image_url: string
  base_price: string
  original_price: string | null
  rating: string
  review_count: number
  is_limited: boolean
  is_sale: boolean
  is_new: boolean
  is_exclusive: boolean
  tags: string[]
  default_variant_id: number | null
}

type PaginatedProducts = {
  count: number
  results: ApiProduct[]
  next: string | null
}

// ─── Contact modal ──────────────────────────────────────────

function ContactModal({
  artist,
  onClose,
}: {
  artist: Artist
  onClose: () => void
}) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const isLoggedIn = !!getAccessToken()

  async function handleSend() {
    if (!message.trim()) return
    if (!isLoggedIn) {
      router.push(`/login?next=/artists/${artist.handle}`)
      return
    }
    setSending(true)
    setError("")
    try {
      const conv = await authFetch<{ id: number }>("/messaging/conversations/", {
        method: "POST",
        body: JSON.stringify({
          subject: `Message to ${artist.name}`,
          vendor_id: artist.vendor_id,
          initial_message: message.trim(),
        }),
      })
      router.push(`/inbox?conv=${conv.id}`)
    } catch {
      setError("Failed to send message. Please try again.")
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border">
          <div className="flex items-center gap-3">
            {artist.avatar_url ? (
              <img src={artist.avatar_url} alt={artist.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-dp-accent-cta/20 flex items-center justify-center">
                <Palette size={16} className="text-dp-accent-cta" />
              </div>
            )}
            <div>
              <p className="text-[13px] font-bold text-dp-text-primary">{artist.name}</p>
              <p className="text-[11px] text-dp-text-tertiary">@{artist.handle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {!isLoggedIn && (
            <p className="text-[12px] text-dp-text-secondary bg-dp-bg-elevated border border-dp-border px-4 py-3 rounded-sm">
              You need to be logged in to send a message.
            </p>
          )}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Write your message to ${artist.name}…`}
            rows={5}
            className="w-full resize-none px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
          />
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white text-[13px] font-bold uppercase tracking-wider rounded-sm transition-colors"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {isLoggedIn ? "Send Message" : "Log in to Send"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter pill ─────────────────────────────────────────────

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full border transition-colors ${
        active
          ? "bg-dp-accent-cta border-dp-accent-cta text-white"
          : "bg-transparent border-dp-border text-dp-text-secondary hover:border-dp-border-hover hover:text-dp-text-primary"
      }`}
    >
      {children}
    </button>
  )
}

// ─── Main page ───────────────────────────────────────────────

export default function ArtistPage() {
  const { handle } = useParams<{ handle: string }>()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [nextUrl, setNextUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [artistError, setArtistError] = useState(false)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterSale, setFilterSale] = useState(false)
  const [filterNew, setFilterNew] = useState(false)
  const [filterLimited, setFilterLimited] = useState(false)
  const [filterExclusive, setFilterExclusive] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // Fetch artist details
  useEffect(() => {
    if (!handle) return
    apiFetch<Artist>(`/products/artists/${handle}/`)
      .then(setArtist)
      .catch(() => setArtistError(true))
  }, [handle])

  // Fetch products whenever filters / search change
  const fetchProducts = useCallback(async () => {
    if (!handle) return
    setLoading(true)
    const params = new URLSearchParams({ artist: handle, page_size: "24" })
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (filterSale)      params.set("sale", "true")
    if (filterNew)       params.set("new", "true")
    if (filterLimited)   params.set("limited", "true")
    if (filterExclusive) params.set("exclusive", "true")

    try {
      const data = await apiFetch<PaginatedProducts>(`/products/?${params}`)
      setProducts(data.results)
      setTotalCount(data.count)
      setNextUrl(data.next)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [handle, debouncedSearch, filterSale, filterNew, filterLimited, filterExclusive])

  useEffect(() => { void fetchProducts() }, [fetchProducts])

  async function loadMore() {
    if (!nextUrl || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await apiFetch<PaginatedProducts>(nextUrl.replace(/^https?:\/\/[^/]+\/api/, ""))
      setProducts((prev) => [...prev, ...data.results])
      setNextUrl(data.next)
    } catch { /* noop */ }
    finally { setLoadingMore(false) }
  }

  const badgeColor: Record<string, string> = {
    Bronze: "text-amber-600",
    Silver: "text-slate-400",
    Gold: "text-yellow-400",
    Platinum: "text-cyan-300",
    Diamond: "text-violet-300",
  }

  if (artistError) {
    return (
      <SiteShell>
        <div className="dp-container py-32 text-center">
          <p className="text-dp-text-tertiary text-lg">Artist not found.</p>
        </div>
      </SiteShell>
    )
  }

  return (
    <SiteShell>
      {/* ── Cover ── */}
      <div className="relative w-full overflow-hidden" style={{ height: "420px" }}>
        {artist?.cover_url ? (
          <img
            src={artist.cover_url}
            alt={artist.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-dp-bg-elevated to-dp-bg-base" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dp-bg-base via-dp-bg-base/30 to-transparent" />

        {/* Artist info at bottom of cover */}
        <div className="absolute bottom-0 left-0 right-0 dp-container pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
            <div className="flex items-end gap-4 min-w-0 flex-1">
            {/* Avatar */}
            <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dp-border overflow-hidden bg-dp-bg-elevated shadow-xl">
              {artist?.avatar_url ? (
                <img src={artist.avatar_url} alt={artist?.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Palette size={28} className="text-dp-accent-cta" />
                </div>
              )}
            </div>

            {/* Name + stats */}
            <div className="flex-1 min-w-0">
              {artist ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-display text-3xl md:text-4xl text-dp-text-primary leading-none">
                      {artist.name}
                    </h1>
                    {artist.verified && (
                      <CheckCircle size={18} className="text-dp-accent-cta shrink-0" />
                    )}
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${badgeColor[artist.badge] ?? "text-dp-text-tertiary"}`}>
                      {artist.badge}
                    </span>
                  </div>
                  <p className="text-[12px] text-dp-text-tertiary mt-1">@{artist.handle}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-[12px] text-dp-text-secondary">
                      <Palette size={13} className="text-dp-text-tertiary" />
                      {artist.designs} designs
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] text-dp-text-secondary">
                      <Users size={13} className="text-dp-text-tertiary" />
                      {artist.followers.toLocaleString()} followers
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-8 w-48 bg-dp-bg-elevated animate-pulse rounded-sm" />
              )}
            </div>
            </div>

            {artist?.vendor_id && (
              <button
                onClick={() => setShowContact(true)}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-wider rounded-sm transition-colors shadow-lg"
              >
                <MessageSquare size={14} />
                Contact Artist
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Bio ── */}
      {artist?.bio && (
        <div className="dp-container pt-5 pb-2">
          <p className="text-[13px] text-dp-text-secondary max-w-2xl leading-relaxed">{artist.bio}</p>
        </div>
      )}

      {/* ── Search + Filters ── */}
      <div className="dp-container py-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dp-text-tertiary pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${artist?.name ?? "artist"}'s work…`}
              className="w-full pl-9 pr-4 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal size={14} className="text-dp-text-tertiary" />
            <Pill active={filterSale} onClick={() => setFilterSale((v) => !v)}>Sale</Pill>
            <Pill active={filterNew} onClick={() => setFilterNew((v) => !v)}>New</Pill>
            <Pill active={filterLimited} onClick={() => setFilterLimited((v) => !v)}>Limited</Pill>
            <Pill active={filterExclusive} onClick={() => setFilterExclusive((v) => !v)}>Exclusive</Pill>
            {(filterSale || filterNew || filterLimited || filterExclusive) && (
              <button
                onClick={() => { setFilterSale(false); setFilterNew(false); setFilterLimited(false); setFilterExclusive(false) }}
                className="text-[11px] text-dp-text-tertiary hover:text-dp-text-primary underline transition-colors ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Result count */}
        <p className="text-[11px] text-dp-text-tertiary mt-3">
          {loading ? "Loading…" : `${totalCount} ${totalCount === 1 ? "work" : "works"}`}
          {debouncedSearch && !loading && ` matching "${debouncedSearch}"`}
        </p>
      </div>

      {/* ── Products grid ── */}
      <div className="dp-container pb-16">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-dp-bg-elevated animate-pulse rounded-sm" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 flex flex-col items-center gap-3 text-dp-text-tertiary">
            <Palette size={40} className="opacity-25" />
            <p className="text-[14px] font-medium">No works found</p>
            {(debouncedSearch || filterSale || filterNew || filterLimited || filterExclusive) && (
              <button
                onClick={() => { setSearch(""); setFilterSale(false); setFilterNew(false); setFilterLimited(false); setFilterExclusive(false) }}
                className="text-[12px] text-dp-accent-cta hover:underline mt-1"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={{
                    id: String(p.id),
                    title: p.title,
                    artistName: p.artist_name,
                    imageUrl: p.image_url,
                    price: parseFloat(p.base_price),
                    originalPrice: p.original_price ? parseFloat(p.original_price) : null,
                    rating: parseFloat(p.rating),
                    reviews: p.review_count,
                    isLimited: p.is_limited,
                    isSale: p.is_sale,
                    isNew: p.is_new,
                    isExclusive: p.is_exclusive,
                    category: p.category_slug,
                    tags: p.tags,
                    defaultVariantId: p.default_variant_id,
                  }}
                />
              ))}
            </div>

            {nextUrl && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-8 py-3 border border-dp-border text-[12px] font-bold uppercase tracking-wider text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover rounded-sm transition-colors disabled:opacity-40"
                >
                  {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Contact modal ── */}
      {showContact && artist && (
        <ContactModal artist={artist} onClose={() => setShowContact(false)} />
      )}
    </SiteShell>
  )
}
