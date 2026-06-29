"use client"

import React, { useState, useEffect, useCallback } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import Link from "next/link"
import { Zap, Clock, Users, TrendingUp, Trophy, ChevronUp, CheckCircle } from "lucide-react"
import { apiFetch, authFetch, parseList, type PaginatedResponse } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

type ApiAuction = {
  id: number
  title: string
  artist_name: string
  image_url: string
  starting_bid: string
  current_bid: string
  bid_count: number
  top_bidder: string
  ends_at: string
  is_live: boolean
  recent_bids: Array<{ id: number; user_name: string; amount: string; placed_at: string }>
}

// ─── Countdown timer ──────────────────────────────────────
function useCountdown(isoTarget: string) {
  const calc = useCallback(() => {
    const diff = new Date(isoTarget).getTime() - Date.now()
    if (diff <= 0) return { h: 0, m: 0, s: 0, done: true }
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1000)
    return { h, m, s, done: false }
  }, [isoTarget])

  const [time, setTime] = useState(calc)

  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [calc])

  return time
}

function CountdownBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-dp-bg-elevated border border-dp-border rounded-sm px-3 py-2 min-w-[48px]">
      <span className="font-display text-2xl text-dp-text-primary leading-none tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] text-dp-text-tertiary uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  )
}

// ─── Bid history mock ─────────────────────────────────────
const BID_HISTORY = [
  { bidder: "collector_x91", amount: 284.00, ago: "2m ago",  isTop: true  },
  { bidder: "neon_hawk",      amount: 271.00, ago: "5m ago",  isTop: false },
  { bidder: "artghost99",     amount: 255.00, ago: "12m ago", isTop: false },
  { bidder: "ironframe_7",    amount: 240.00, ago: "18m ago", isTop: false },
  { bidder: "steelwall",      amount: 220.00, ago: "34m ago", isTop: false },
]

// ─── Single auction card (for the list view) ─────────────
function AuctionCard({ item }: { item: (typeof AUCTIONS)[number] }) {
  const { h, m, s, done } = useCountdown(item.endsAt)
  const urgent = !done && h === 0 && m < 10

  return (
    <Link
      href={`/auctions/${item.id}`}
      className="group flex flex-col sm:flex-row gap-4 bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover"
    >
      {/* Image */}
      <div className="relative sm:w-40 aspect-poster sm:aspect-auto overflow-hidden bg-dp-bg-elevated shrink-0">
        <Image
          src={item.imageUrl}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="160px"
        />
        {item.isLive && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-dp-accent-cta text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden /> Live
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-between py-3 px-1 sm:px-0 flex-1 min-w-0">
        <div>
          <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-0.5">{item.artistName}</p>
          <h3 className="font-display text-2xl text-dp-text-primary leading-tight">{item.title}</h3>
          <div className="flex items-center gap-3 mt-2 text-[12px] text-dp-text-tertiary">
            <span className="flex items-center gap-1"><Users size={12} />{item.bidCount} bids</span>
            <span>·</span>
            <span>Top bidder: <strong className="text-dp-text-secondary">{item.topBidder}</strong></span>
          </div>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3 mt-3">
          {/* Price */}
          <div>
            <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Current Bid</p>
            <p className="font-display text-3xl text-dp-accent-gold leading-none">
              ${item.currentBid.toFixed(2)}
            </p>
          </div>
          {/* Countdown */}
          <div>
            <p className={`text-[10px] uppercase tracking-widest mb-1.5 ${urgent ? "text-dp-accent-cta" : "text-dp-text-tertiary"}`}>
              {done ? "Ended" : "Ends in"}
            </p>
            <div className="flex gap-1.5">
              <CountdownBlock label="hrs" value={h} />
              <CountdownBlock label="min" value={m} />
              <CountdownBlock label="sec" value={s} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Featured auction (hero-style) ────────────────────────
function FeaturedAuction({ item }: { item: (typeof AUCTIONS)[number] }) {
  const { h, m, s, done } = useCountdown(item.endsAt)
  const [bidInput, setBidInput]       = useState("")
  const [lastBid, setLastBid]         = useState<number | null>(null)
  const [bidError, setBidError]       = useState("")
  const [confirmed, setConfirmed]     = useState(false)
  const minBid = item.currentBid + 5

  const handleBid = () => {
    const val = parseFloat(bidInput)
    if (isNaN(val) || val < minBid) {
      setBidError(`Minimum bid is $${minBid.toFixed(2)}`)
      return
    }
    setBidError("")
    setLastBid(val)
    setConfirmed(true)
    setTimeout(() => setConfirmed(false), 3000)
    setBidInput("")
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      {/* Image */}
      <div className="relative lg:w-96 aspect-poster lg:aspect-auto overflow-hidden bg-dp-bg-elevated shrink-0">
        <Image
          src={item.imageUrl}
          alt={item.title}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 384px"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, transparent 60%, var(--dp-bg-surface) 100%)" }}
          aria-hidden
        />
        {item.isLive && (
          <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />
            Live Auction
          </span>
        )}
      </div>

      {/* Right panel */}
      <div className="flex flex-col justify-between py-6 pr-6 pl-6 lg:pl-0 flex-1 min-w-0">
        <div>
          <p className="text-[11px] text-dp-text-tertiary uppercase tracking-[0.14em] mb-1">Featured Drop — {item.artistName}</p>
          <h2 className="font-display text-4xl md:text-5xl text-dp-text-primary leading-none mb-3">{item.title}</h2>

          {/* Stats row */}
          <div className="flex flex-wrap gap-5 text-[13px] mb-5">
            <div>
              <p className="text-dp-text-tertiary text-[10px] uppercase tracking-widest">Starting Bid</p>
              <p className="text-dp-text-secondary font-semibold">${item.startingBid.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-dp-text-tertiary text-[10px] uppercase tracking-widest">Total Bids</p>
              <p className="text-dp-text-secondary font-semibold flex items-center gap-1"><TrendingUp size={12} />{item.bidCount}</p>
            </div>
            <div>
              <p className="text-dp-text-tertiary text-[10px] uppercase tracking-widest">Top Bidder</p>
              <p className="text-dp-text-secondary font-semibold flex items-center gap-1"><Trophy size={12} className="text-dp-accent-gold" />{item.topBidder}</p>
            </div>
          </div>

          {/* Current bid */}
          <div className="flex items-baseline gap-3 mb-2">
            <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Current Bid</p>
          </div>
          <p className="font-display text-6xl text-dp-accent-gold leading-none mb-5">
            ${(lastBid ?? item.currentBid).toFixed(2)}
          </p>

          {/* Countdown */}
          <div className="flex items-center gap-3 mb-6">
            <Clock size={14} className="text-dp-text-tertiary" />
            <span className="text-[12px] text-dp-text-tertiary uppercase tracking-widest mr-2">
              {done ? "Auction ended" : "Ends in"}
            </span>
            {!done && (
              <div className="flex gap-1.5">
                <CountdownBlock label="hrs" value={h} />
                <CountdownBlock label="min" value={m} />
                <CountdownBlock label="sec" value={s} />
              </div>
            )}
          </div>
        </div>

        {/* Bid form */}
        {!done && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary text-sm">$</span>
                <input
                  type="number"
                  value={bidInput}
                  onChange={(e) => { setBidInput(e.target.value); setBidError("") }}
                  placeholder={`${minBid.toFixed(2)} or more`}
                  min={minBid}
                  step={0.5}
                  className="w-full pl-7 pr-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary text-sm placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-accent-cta transition-colors"
                  aria-label="Your bid amount"
                />
              </div>
              <button
                onClick={handleBid}
                className={`flex items-center gap-2 px-6 py-3 rounded-sm text-[13px] font-bold uppercase tracking-widest transition-all shrink-0 ${
                  confirmed
                    ? "bg-dp-success text-white"
                    : "bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white"
                }`}
              >
                {confirmed ? <><CheckCircle size={15} /> Bid placed!</> : <><Zap size={15} /> Place Bid</>}
              </button>
            </div>
            {bidError && <p className="text-[12px] text-dp-accent-cta">{bidError}</p>}
            <p className="text-[11px] text-dp-text-tertiary">Min increment: $5.00 · Buyer&apos;s premium: 10%</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bid history table ────────────────────────────────────
function BidHistoryTable() {
  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-dp-border">
        <h3 className="font-display text-xl text-dp-text-primary">Recent Bids</h3>
      </div>
      <ul>
        {BID_HISTORY.map((bid, i) => (
          <li
            key={i}
            className={`flex items-center justify-between px-4 py-3 border-b border-dp-border last:border-b-0 ${
              bid.isTop ? "bg-dp-accent-gold/5" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              {bid.isTop && <Trophy size={13} className="text-dp-accent-gold shrink-0" aria-label="Top bid" />}
              <span className={`text-[13px] font-semibold ${bid.isTop ? "text-dp-accent-gold" : "text-dp-text-secondary"}`}>
                {bid.bidder}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-[14px] font-bold ${bid.isTop ? "text-dp-accent-gold" : "text-dp-text-primary"}`}>
                ${bid.amount.toFixed(2)}
              </span>
              <span className="text-[11px] text-dp-text-tertiary w-16 text-right">{bid.ago}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Leaderboard ─────────────────────────────────────────
const LEADERBOARD = [
  { rank: 1, username: "collector_x91", wins: 14, totalSpend: 3840 },
  { rank: 2, username: "neon_hawk",      wins: 11, totalSpend: 2910 },
  { rank: 3, username: "artghost99",     wins:  9, totalSpend: 2440 },
  { rank: 4, username: "ironframe_7",    wins:  7, totalSpend: 1830 },
  { rank: 5, username: "steelwall",      wins:  5, totalSpend: 1290 },
]

function Leaderboard() {
  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-dp-border flex items-center gap-2">
        <Trophy size={16} className="text-dp-accent-gold" aria-hidden />
        <h3 className="font-display text-xl text-dp-text-primary">Top Collectors</h3>
      </div>
      <ul>
        {LEADERBOARD.map((entry) => (
          <li
            key={entry.rank}
            className="flex items-center gap-3 px-4 py-3 border-b border-dp-border last:border-b-0 hover:bg-dp-bg-elevated transition-colors"
          >
            <span
              className={`font-display text-xl w-6 text-center leading-none ${
                entry.rank === 1 ? "text-dp-accent-gold"
                : entry.rank === 2 ? "text-[#b0b0b0]"
                : entry.rank === 3 ? "text-[#c9a84c]"
                : "text-dp-text-tertiary"
              }`}
            >
              {entry.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-dp-text-primary truncate">{entry.username}</p>
              <p className="text-[11px] text-dp-text-tertiary">{entry.wins} wins</p>
            </div>
            <span className="text-[13px] font-bold text-dp-text-primary">${entry.totalSpend.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────
export default function AuctionsPage(): React.ReactElement {
  const [auctions, setAuctions] = useState<ApiAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState("")
  const [bidError, setBidError] = useState("")
  const [bidLoading, setBidLoading] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false
    apiFetch<ApiAuction[] | PaginatedResponse<ApiAuction>>("/auctions/")
      .then((data) => { if (!cancelled) setAuctions(parseList(data)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const featured = auctions[0]
  const upcoming = auctions.slice(1)

  async function handleBid(auctionId: number) {
    if (!user) { setBidError("Please sign in to bid."); return }
    setBidError("")
    setBidLoading(true)
    try {
      await authFetch(`/auctions/${auctionId}/bid/`, { method: "POST", body: JSON.stringify({ amount: parseFloat(bidAmount) }) })
      const updated = await apiFetch<ApiAuction[] | PaginatedResponse<ApiAuction>>("/auctions/")
      setAuctions(parseList(updated))
      setBidAmount("")
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setBidError(apiErr?.data?.detail ?? "Bid failed.")
    } finally {
      setBidLoading(false)
    }
  }

  return (
    <SiteShell>
      {/* Header */}
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />
              Live
            </span>
            <h1 className="font-display text-4xl md:text-5xl text-dp-text-primary">Live Auctions</h1>
          </div>
          <p className="text-dp-text-secondary text-sm mt-1 max-w-xl">
            Bid on exclusive, one-of-a-kind prints directly from artists. Every win earns 500 XP.
          </p>
        </div>
      </div>

      <div className="dp-container py-10 flex flex-col gap-10">

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-80 bg-dp-bg-elevated rounded-sm" />
            <div className="h-32 bg-dp-bg-elevated rounded-sm" />
          </div>
        ) : featured ? (
          <>
            {/* Featured + bid history */}
            <div className="flex flex-col xl:flex-row gap-6">
              <div className="flex-1 min-w-0">
                {/* Featured auction card */}
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
                  <div className="grid md:grid-cols-2 gap-0">
                    <div className="relative aspect-square md:aspect-auto md:min-h-[400px]">
                      <Image src={featured.image_url || "/placeholder.svg"} alt={featured.title} fill className="object-cover" sizes="50vw" />
                    </div>
                    <div className="p-6 flex flex-col gap-4">
                      <div>
                        <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">{featured.artist_name}</p>
                        <h2 className="font-display text-3xl text-dp-text-primary mt-1">{featured.title}</h2>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-[13px]">
                          <span className="text-dp-text-secondary">Current Bid</span>
                          <span className="font-bold text-dp-text-primary text-[18px]">${parseFloat(featured.current_bid).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-dp-text-secondary">Bids</span>
                          <span className="font-semibold">{featured.bid_count}</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-dp-text-secondary">Top Bidder</span>
                          <span className="font-semibold">{featured.top_bidder}</span>
                        </div>
                      </div>
                      {bidError && <p className="text-[12px] text-dp-accent-cta">{bidError}</p>}
                      <div className="flex gap-2 mt-auto">
                        <input
                          type="number"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder={`Min $${(parseFloat(featured.current_bid) + 5).toFixed(2)}`}
                          className="flex-1 px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover"
                        />
                        <button
                          onClick={() => handleBid(featured.id)}
                          disabled={bidLoading || !bidAmount}
                          className="px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
                        >
                          {bidLoading ? "…" : "Bid"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bid history */}
                <div className="mt-4 bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                  <h3 className="font-display text-xl text-dp-text-primary mb-3">Recent Bids</h3>
                  {featured.recent_bids.length === 0 ? (
                    <p className="text-[13px] text-dp-text-tertiary">No bids yet — be the first!</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {featured.recent_bids.map((bid) => (
                        <div key={bid.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-dp-text-secondary">{bid.user_name}</span>
                          <span className="font-bold text-dp-text-primary">${parseFloat(bid.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming / other auctions */}
            {upcoming.length > 0 && (
              <section aria-labelledby="upcoming-heading">
                <h2 className="font-display text-3xl text-dp-text-primary mb-5" id="upcoming-heading">
                  More Auctions
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcoming.map((item) => (
                    <div key={item.id} className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
                      <div className="relative aspect-[4/3]">
                        <Image src={item.image_url || "/placeholder.svg"} alt={item.title} fill className="object-cover" sizes="33vw" />
                      </div>
                      <div className="p-4">
                        <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">{item.artist_name}</p>
                        <p className="font-bold text-dp-text-primary mt-0.5">{item.title}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-[15px] font-bold">${parseFloat(item.current_bid).toFixed(2)}</span>
                          <span className="text-[11px] text-dp-text-tertiary">{item.bid_count} bids</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="py-24 text-center">
            <p className="font-display text-3xl text-dp-text-primary mb-2">No Active Auctions</p>
            <p className="text-dp-text-tertiary">Check back soon for upcoming drops.</p>
          </div>
        )}

        {/* How it works */}
        <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6 md:p-8 mt-4" aria-labelledby="how-heading">
          <h2 className="font-display text-3xl text-dp-text-primary mb-6" id="how-heading">How Auctions Work</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Browse Drops",        body: "Exclusive prints go live weekly. Each has a starting bid and a countdown timer." },
              { step: "02", title: "Place Your Bid",      body: "Enter any amount above the current bid. Minimum increment is $5.00." },
              { step: "03", title: "Win & Earn XP",       body: "Highest bid when the timer hits zero wins. You receive 500 XP and the Auction Gladiator badge." },
              { step: "04", title: "Receive Your Print",  body: "We ship your signed, framed piece within 5 business days. Free for auction winners." },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col gap-2">
                <span className="font-display text-5xl text-dp-bg-divider leading-none">{step}</span>
                <p className="font-semibold text-[14px] text-dp-text-primary">{title}</p>
                <p className="text-[13px] text-dp-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </SiteShell>
  )
}
