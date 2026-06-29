"use client"

import React, { useState, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Link from "next/link"
import { CheckCircle, Palette, Users, Search } from "lucide-react"
import { apiFetch, parseList, type PaginatedResponse } from "@/lib/api"

type Artist = {
  id: number
  name: string
  handle: string
  avatar_url: string
  cover_url: string
  bio: string
  designs: number
  followers: number
  badge: string
  verified: boolean
  vendor_id: number | null
}

const badgeColor: Record<string, string> = {
  Bronze: "text-amber-600 border-amber-600/30",
  Silver: "text-slate-400 border-slate-400/30",
  Gold: "text-yellow-400 border-yellow-400/30",
  Platinum: "text-cyan-300 border-cyan-300/30",
  Diamond: "text-violet-300 border-violet-300/30",
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    apiFetch<Artist[] | PaginatedResponse<Artist>>("/products/artists/?page_size=50")
      .then((d) => setArtists(parseList(d)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = artists.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.handle.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SiteShell>
      {/* Hero */}
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-12">
          <h1 className="font-display text-5xl md:text-6xl text-dp-text-primary mb-3">Artists</h1>
          <p className="text-dp-text-secondary text-[14px] max-w-lg">
            Discover the creators behind every design. Browse their collections, follow their work, and reach out directly.
          </p>

          {/* Search */}
          <div className="relative mt-6 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dp-text-tertiary pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search artists…"
              className="w-full pl-9 pr-4 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="dp-container py-10 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 bg-dp-bg-elevated animate-pulse rounded-sm" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Palette size={36} className="opacity-20 mx-auto mb-3" />
            <p className="text-dp-text-tertiary">No artists found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.handle}`}
                className="group block bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover"
              >
                {/* Cover */}
                <div className="relative h-28 bg-dp-bg-elevated overflow-hidden">
                  {artist.cover_url ? (
                    <img
                      src={artist.cover_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-dp-accent-cta/10 to-dp-bg-base" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dp-bg-surface/80 to-transparent" />

                  {/* Avatar */}
                  <div className="absolute bottom-3 left-4 w-12 h-12 rounded-full border-2 border-dp-border overflow-hidden bg-dp-bg-elevated shadow-lg">
                    {artist.avatar_url ? (
                      <img src={artist.avatar_url} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Palette size={16} className="text-dp-accent-cta" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="px-4 pt-2 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[14px] font-bold text-dp-text-primary truncate group-hover:text-dp-accent-cta transition-colors">
                        {artist.name}
                      </p>
                      {artist.verified && <CheckCircle size={13} className="text-dp-accent-cta shrink-0" />}
                    </div>
                    {artist.badge && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${badgeColor[artist.badge] ?? "text-dp-text-tertiary border-dp-border"}`}>
                        {artist.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-dp-text-tertiary">@{artist.handle}</p>

                  {artist.bio && (
                    <p className="text-[12px] text-dp-text-secondary mt-2 line-clamp-2 leading-relaxed">{artist.bio}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1 text-[11px] text-dp-text-tertiary">
                      <Palette size={11} />
                      {artist.designs} designs
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-dp-text-tertiary">
                      <Users size={11} />
                      {artist.followers.toLocaleString()}
                    </span>
                    {artist.vendor_id && (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-dp-accent-cta">
                        Contact
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
