"use client"

import React, { useState, useEffect, useCallback } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import Link from "next/link"
import { Clock, Users, Trophy, Flame, CheckCircle2 } from "lucide-react"
import { apiFetch, parseList, type PaginatedResponse } from "@/lib/api"
import { useLocale } from "@/contexts/locale-context"

// ─── Types ───────────────────────────────────────────────────────────────────

type ApiAuction = {
  id: number
  slug: string
  title: string
  artist_name: string
  image_url: string
  effective_image: string | null
  starting_bid: string
  current_bid: string
  bid_count: number
  top_bidder: string
  ends_at: string
  is_live: boolean
  is_ended: boolean
  recent_bids: Array<{ id: number; user_name: string; amount: string; placed_at: string }>
}

type LeaderboardEntry = {
  rank: number
  name: string
  wins: number
  total_spent: number
  bid_count?: number
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(isoTarget: string) {
  const calc = useCallback(() => {
    const diff = new Date(isoTarget).getTime() - Date.now()
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true }
    const d = Math.floor(diff / 86_400_000)
    const h = Math.floor((diff % 86_400_000) / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1000)
    return { d, h, m, s, done: false }
  }, [isoTarget])

  const [time, setTime] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [calc])
  return time
}

// ─── CountdownChip ────────────────────────────────────────────────────────────

function CountdownChip({ endsAt, ended }: { endsAt: string; ended: boolean }) {
  const { d, h, m, s, done } = useCountdown(endsAt)
  if (ended || done) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-dp-text-tertiary">
        <CheckCircle2 size={11} />
        Ended
      </span>
    )
  }
  const urgent = d === 0 && h === 0 && m < 10
  const parts = d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
  return (
    <span className={`flex items-center gap-1 text-[11px] font-mono font-semibold ${urgent ? "text-dp-accent-cta" : "text-dp-text-secondary"}`}>
      <Clock size={11} />
      {parts}
    </span>
  )
}

// ─── Auction Card ────────────────────────────────────────────────────────────

function AuctionCard({ a }: { a: ApiAuction }) {
  const { formatPrice } = useLocale()
  const img = a.effective_image || a.image_url || "/placeholder.svg"
  const price = parseFloat(a.current_bid)

  return (
    <Link
      href={`/auctions/${a.slug || a.id}`}
      className="group relative flex flex-col bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden transition-shadow hover:shadow-lg hover:border-dp-border-hover"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-dp-bg-elevated">
        <Image
          src={img}
          alt={a.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Status badge */}
        <div className="absolute top-2 left-2">
          {a.is_ended ? (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-black/60 text-white/60">
              Ended
            </span>
          ) : a.is_live ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-dp-accent-cta text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-dp-bg-elevated/90 text-dp-text-secondary border border-dp-border">
              Upcoming
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">{a.artist_name}</p>
        <h3 className="font-display text-xl text-dp-text-primary leading-tight line-clamp-2">{a.title}</h3>

        <div className="flex items-center justify-between mt-auto pt-2">
          <div>
            <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-0.5">
              {a.is_ended ? "Final Bid" : "Current Bid"}
            </p>
            <p className="font-display text-2xl text-dp-accent-gold leading-none">
                {isNaN(price) ? "—" : formatPrice(price)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-dp-text-tertiary flex items-center justify-end gap-1 mb-1">
              <Users size={11} /> {a.bid_count} bids
            </p>
            <CountdownChip endsAt={a.ends_at} ended={a.is_ended} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Global Leaderboard ───────────────────────────────────────────────────────

function GlobalLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const MEDAL = ["🥇", "🥈", "🥉"]

  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-dp-border flex items-center gap-2">
        <Trophy size={16} className="text-dp-accent-gold" />
        <h2 className="font-display text-xl text-dp-text-primary">Top Collectors</h2>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-dp-text-tertiary">
          No winners yet — be the first to win an auction!
        </p>
      ) : (
        <ul className="divide-y divide-dp-border">
          {entries.map((e) => (
            <li key={e.rank} className="flex items-center gap-3 px-5 py-3 hover:bg-dp-bg-elevated transition-colors">
              <span className="text-lg w-6 text-center leading-none shrink-0">
                {e.rank <= 3 ? MEDAL[e.rank - 1] : <span className="font-display text-dp-text-tertiary text-[15px]">{e.rank}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-dp-text-primary truncate">{e.name}</p>
                <p className="text-[11px] text-dp-text-tertiary">
                  {e.wins > 0 ? `${e.wins} auction win${e.wins !== 1 ? "s" : ""}` : `${e.bid_count ?? 0} bids placed`}
                </p>
              </div>
              <span className="text-[13px] font-bold text-dp-text-primary shrink-0">
                ${e.total_spent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

type Filter = "all" | "live" | "upcoming" | "ended"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "ended", label: "Ended" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuctionsPage(): React.ReactElement {
  const [auctions, setAuctions] = useState<ApiAuction[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch<ApiAuction[] | PaginatedResponse<ApiAuction>>("/auctions/").then(parseList),
      apiFetch<LeaderboardEntry[]>("/auctions/leaderboard/").catch(() => []),
    ]).then(([aList, lList]) => {
      if (!cancelled) {
        setAuctions(aList)
        setLeaderboard(Array.isArray(lList) ? lList : [])
        setLoading(false)
      }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = auctions.filter((a) => {
    if (filter === "live") return !a.is_ended && a.is_live
    if (filter === "upcoming") return !a.is_ended && !a.is_live
    if (filter === "ended") return a.is_ended
    return true
  })

  const liveCount = auctions.filter((a) => !a.is_ended && a.is_live).length

  return (
    <SiteShell>
      {/* Page header */}
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-8">
          <div className="flex items-center gap-3 mb-2">
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {liveCount} Live
              </span>
            )}
            <h1 className="font-display text-5xl text-dp-text-primary">Auctions</h1>
          </div>
          <p className="text-dp-text-secondary text-[14px] max-w-xl">
            Bid on exclusive, one-of-a-kind pieces directly from artists. Every win earns 500 XP.
          </p>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-1.5 rounded-sm text-[12px] font-semibold uppercase tracking-widest transition-colors ${
                  filter === f.id
                    ? "bg-dp-text-primary text-dp-bg-surface"
                    : "bg-dp-bg-elevated text-dp-text-secondary hover:text-dp-text-primary border border-dp-border"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dp-container py-10">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-dp-bg-elevated rounded-sm mb-3" />
                <div className="h-4 bg-dp-bg-elevated rounded w-3/4 mb-2" />
                <div className="h-3 bg-dp-bg-elevated rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col xl:flex-row gap-8">
            {/* Auction grid */}
            <div className="flex-1 min-w-0">
              {filtered.length === 0 ? (
                <div className="py-24 text-center">
                  <Flame size={40} className="mx-auto text-dp-text-tertiary mb-4" />
                  <p className="font-display text-3xl text-dp-text-primary mb-2">No Auctions Found</p>
                  <p className="text-dp-text-tertiary text-[14px]">
                    {filter === "all" ? "Check back soon for upcoming drops." : `No ${filter} auctions right now.`}
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.map((a) => (
                    <AuctionCard key={a.id} a={a} />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar: leaderboard + how it works */}
            <div className="xl:w-72 flex flex-col gap-6 shrink-0">
              <GlobalLeaderboard entries={leaderboard} />

              {/* How it works */}
              <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
                <h3 className="font-display text-lg text-dp-text-primary mb-4">How It Works</h3>
                <ol className="flex flex-col gap-3">
                  {[
                    ["Browse Drops", "Exclusive pieces go live weekly."],
                    ["Place Your Bid", "Any amount above the current bid (min +$1)."],
                    ["Win & Earn XP", "Highest bid when timer ends wins. +500 XP."],
                    ["Receive Your Piece", "Signed & shipped within 5 business days."],
                  ].map(([title, body], i) => (
                    <li key={i} className="flex gap-3">
                      <span className="font-display text-2xl text-dp-bg-divider leading-none shrink-0 w-6">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-dp-text-primary">{title}</p>
                        <p className="text-[12px] text-dp-text-secondary leading-relaxed">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  )
}
