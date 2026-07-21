"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import LocalizedLink from "@/components/seo/LocalizedLink"
import {
  Clock,
  Users,
  Trophy,
  Zap,
  CheckCircle,
  AlertCircle,
  X,
  CreditCard,
  MapPin,
  Plus,
  Loader2,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { apiFetch, authFetch } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { getAccessToken } from "@/lib/auth-storage"
import AuctionLiveChat from "@/components/auctions/AuctionLiveChat"
import Breadcrumb from "@/components/seo/Breadcrumb"
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n"

// ─── Auction FAQ ─────────────────────────────────────────────

const AUCTION_FAQS = [
  {
    q: "How do live auctions work?",
    a: "Place a bid at or above the current highest bid. The auction runs until the countdown ends. The highest bidder when time expires wins the item.",
  },
  {
    q: "Are bids binding?",
    a: "Yes. Every bid you place is a commitment to purchase if you win. Please bid only amounts you are prepared to pay.",
  },
  {
    q: "When do I pay if I win?",
    a: "Winners receive checkout instructions by email and must complete payment within 48 hours of the auction ending.",
  },
  {
    q: "What is the minimum bid increment?",
    a: "Each new bid must be at least $1.00 higher than the current highest bid unless otherwise stated on the listing.",
  },
  {
    q: "What happens if I don't pay in time?",
    a: "Unpaid wins may be offered to the next highest bidder or relisted. Repeated non-payment can restrict your ability to bid.",
  },
  {
    q: "How is shipping handled for auction wins?",
    a: "Shipping is calculated at checkout after you win. We ship worldwide using tracked carriers; delivery times vary by destination.",
  },
]

function AuctionFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-dp-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full py-4 text-left group"
        aria-expanded={open}
      >
        <span className="text-[14px] font-bold text-dp-text-primary group-hover:text-dp-accent-cta transition-colors pr-4">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-dp-accent-cta shrink-0" />
          : <ChevronDown size={16} className="text-dp-text-tertiary shrink-0" />}
      </button>
      {open && (
        <p className="pb-4 text-[13px] text-dp-text-secondary leading-relaxed">{a}</p>
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiBid = {
  id: number
  user_name: string
  amount: string
  placed_at: string
}

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
  starts_at: string
  ends_at: string
  status: string
  is_live: boolean
  is_ended: boolean
  is_upcoming?: boolean
  is_biddable?: boolean
  recent_bids: ApiBid[]
}

type PaymentMethod = {
  id: number
  brand: string
  last4: string
  exp_month: number
  exp_year: number
  is_default: boolean
}

type Address = {
  id: number
  label: string
  line1: string
  line2?: string
  city: string
  state: string
  zip_code: string
  country: string
  is_default: boolean
}

// ─── Countdown ───────────────────────────────────────────────────────────────

function useCountdown(isoTarget: string) {
  const calc = useCallback(() => {
    const diff = new Date(isoTarget).getTime() - Date.now()
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true }
    return {
      d: Math.floor(diff / 86_400_000),
      h: Math.floor((diff % 86_400_000) / 3_600_000),
      m: Math.floor((diff % 3_600_000) / 60_000),
      s: Math.floor((diff % 60_000) / 1000),
      done: false,
    }
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
    <div className="flex flex-col items-center bg-dp-bg-elevated border border-dp-border rounded-sm px-3 py-2 min-w-[52px]">
      <span className="font-display text-3xl text-dp-text-primary leading-none tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] text-dp-text-tertiary uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  )
}

// ─── Login Modal ──────────────────────────────────────────────────────────────

function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(email, password)
      onSuccess()
    } catch {
      setError("Invalid email or password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dp-bg-surface border border-dp-border rounded-sm w-full max-w-md p-8 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Lock size={18} className="text-dp-accent-cta" />
          <h2 className="font-display text-2xl text-dp-text-primary">Log In to Bid</h2>
        </div>
        <p className="text-[13px] text-dp-text-secondary mb-6">
          You need an account to place bids. Sign in or{" "}
          <LocalizedLink href="/register" className="text-dp-accent-cta hover:underline" onClick={onClose}>
            create a free account
          </LocalizedLink>
          .
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-dp-text-tertiary uppercase tracking-widest block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary text-[14px] focus:outline-none focus:border-dp-accent-cta transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] text-dp-text-tertiary uppercase tracking-widest block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary text-[14px] focus:outline-none focus:border-dp-accent-cta transition-colors"
            />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-[12px] text-dp-accent-cta">
              <AlertCircle size={13} /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {loading ? "Signing in…" : "Sign In & Bid"}
          </button>
          <LocalizedLink
            href="/forgot-password"
            className="text-center text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors"
            onClick={onClose}
          >
            Forgot password?
          </LocalizedLink>
        </form>
      </div>
    </div>
  )
}

// ─── Bid Confirmation Modal ───────────────────────────────────────────────────

type BidConfirmProps = {
  auction: ApiAuction
  amount: number
  onClose: () => void
  onConfirmed: (updatedAuction: ApiAuction) => void
}

function BidConfirmModal({ auction, amount, onClose, onConfirmed }: BidConfirmProps) {
  const { formatPrice } = useLocale()
  const [cards, setCards] = useState<PaymentMethod[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [selectedAddr, setSelectedAddr] = useState<number | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState("")
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddAddr, setShowAddAddr] = useState(false)

  // New card fields
  const [cardBrand, setCardBrand] = useState("visa")
  const [cardLast4, setCardLast4] = useState("")
  const [cardExpM, setCardExpM] = useState("")
  const [cardExpY, setCardExpY] = useState("")

  // New address fields
  const [addrLine1, setAddrLine1] = useState("")
  const [addrCity, setAddrCity] = useState("")
  const [addrState, setAddrState] = useState("")
  const [addrZip, setAddrZip] = useState("")
  const [addrCountry, setAddrCountry] = useState("US")
  const [addrLabel, setAddrLabel] = useState("Home")

  useEffect(() => {
    Promise.all([
      authFetch<PaymentMethod[]>("/auth/payment-methods/").catch(() => []),
      authFetch<Address[]>("/auth/addresses/").catch(() => []),
    ]).then(([c, a]) => {
      const cardArr = Array.isArray(c) ? c : (c as { results?: PaymentMethod[] }).results ?? []
      const addrArr = Array.isArray(a) ? a : (a as { results?: Address[] }).results ?? []
      setCards(cardArr)
      setAddresses(addrArr)
      const defCard = cardArr.find((x) => x.is_default) ?? cardArr[0]
      const defAddr = addrArr.find((x) => x.is_default) ?? addrArr[0]
      if (defCard) setSelectedCard(defCard.id)
      if (defAddr) setSelectedAddr(defAddr.id)
      setLoadingMeta(false)
    })
  }, [])

  async function addCard() {
    if (!cardLast4.match(/^\d{4}$/) || !cardExpM || !cardExpY) {
      setError("Please fill in all card fields correctly.")
      return
    }
    const c = await authFetch<PaymentMethod>("/auth/payment-methods/", {
      method: "POST",
      body: JSON.stringify({
        brand: cardBrand,
        last4: cardLast4,
        exp_month: parseInt(cardExpM),
        exp_year: parseInt(cardExpY),
        is_default: cards.length === 0,
      }),
    })
    setCards((prev) => [...prev, c])
    setSelectedCard(c.id)
    setShowAddCard(false)
    setError("")
  }

  async function addAddress() {
    if (!addrLine1 || !addrCity || !addrZip) {
      setError("Please fill in address line 1, city, and zip code.")
      return
    }
    const a = await authFetch<Address>("/auth/addresses/", {
      method: "POST",
      body: JSON.stringify({
        label: addrLabel,
        line1: addrLine1,
        city: addrCity,
        state: addrState,
        zip_code: addrZip,
        country: addrCountry,
        is_default: addresses.length === 0,
      }),
    })
    setAddresses((prev) => [...prev, a])
    setSelectedAddr(a.id)
    setShowAddAddr(false)
    setError("")
  }

  async function handleConfirm() {
    if (!selectedCard) { setError("Please select or add a payment method."); return }
    if (!selectedAddr) { setError("Please select or add a delivery address."); return }
    setError("")
    setPlacing(true)
    try {
      const updated = await authFetch<ApiAuction>(`/auctions/${auction.slug || auction.id}/bid/`, {
        method: "POST",
        body: JSON.stringify({ amount: amount }),
      })
      onConfirmed(updated)
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setError(apiErr?.data?.detail ?? "Bid failed. Please try again.")
    } finally {
      setPlacing(false)
    }
  }

  const BRANDS = [
    { value: "visa", label: "Visa" },
    { value: "mastercard", label: "Mastercard" },
    { value: "amex", label: "Amex" },
    { value: "other", label: "Other" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dp-bg-surface border border-dp-border rounded-sm w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dp-bg-surface border-b border-dp-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-display text-2xl text-dp-text-primary">Confirm Your Bid</h2>
          <button onClick={onClose} className="text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Bid summary */}
          <div className="flex items-center gap-4 bg-dp-bg-elevated border border-dp-border rounded-sm p-4">
            <div className="relative w-16 h-16 shrink-0 rounded-sm overflow-hidden bg-dp-bg-surface">
              <Image
                src={auction.effective_image || auction.image_url || "/placeholder.svg"}
                alt={auction.title}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-dp-text-tertiary">{auction.artist_name}</p>
              <p className="font-semibold text-dp-text-primary text-[14px] truncate">{auction.title}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Your Bid</p>
              <p className="font-display text-2xl text-dp-accent-gold">{formatPrice(amount)}</p>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <h3 className="text-[11px] text-dp-text-tertiary uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <CreditCard size={12} /> Payment Method
            </h3>
            {loadingMeta ? (
              <div className="h-12 bg-dp-bg-elevated rounded-sm animate-pulse" />
            ) : (
              <div className="flex flex-col gap-2">
                {cards.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCard(c.id)}
                    className={`flex items-center gap-3 p-3 rounded-sm border text-left transition-colors ${
                      selectedCard === c.id
                        ? "border-dp-accent-cta bg-dp-accent-cta/5"
                        : "border-dp-border hover:border-dp-border-hover bg-dp-bg-elevated"
                    }`}
                  >
                    <CreditCard size={16} className={selectedCard === c.id ? "text-dp-accent-cta" : "text-dp-text-tertiary"} />
                    <span className="flex-1 text-[13px] text-dp-text-primary font-semibold capitalize">
                      {c.brand} •••• {c.last4}
                    </span>
                    <span className="text-[11px] text-dp-text-tertiary">
                      {c.exp_month}/{String(c.exp_year).slice(-2)}
                    </span>
                    {selectedCard === c.id && <CheckCircle size={14} className="text-dp-accent-cta shrink-0" />}
                  </button>
                ))}

                {/* Add card form */}
                {showAddCard ? (
                  <div className="border border-dp-border rounded-sm p-4 bg-dp-bg-elevated flex flex-col gap-3">
                    <p className="text-[12px] font-semibold text-dp-text-primary">Add a new card</p>
                    <select
                      value={cardBrand}
                      onChange={(e) => setCardBrand(e.target.value)}
                      className="px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                    >
                      {BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input
                        placeholder="Last 4 digits"
                        maxLength={4}
                        value={cardLast4}
                        onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))}
                        className="flex-1 px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                      />
                      <input
                        placeholder="MM"
                        maxLength={2}
                        value={cardExpM}
                        onChange={(e) => setCardExpM(e.target.value.replace(/\D/g, ""))}
                        className="w-16 px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                      />
                      <input
                        placeholder="YYYY"
                        maxLength={4}
                        value={cardExpY}
                        onChange={(e) => setCardExpY(e.target.value.replace(/\D/g, ""))}
                        className="w-24 px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addCard}
                        className="flex-1 py-2 bg-dp-accent-cta text-white text-[12px] font-bold uppercase rounded-sm hover:bg-dp-accent-cta-hover transition-colors"
                      >
                        Save Card
                      </button>
                      <button
                        onClick={() => { setShowAddCard(false); setError("") }}
                        className="px-4 py-2 border border-dp-border text-[12px] text-dp-text-secondary rounded-sm hover:bg-dp-bg-elevated transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddCard(true)}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-dp-border rounded-sm text-[12px] text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
                  >
                    <Plus size={14} /> Add a card
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Delivery address */}
          <div>
            <h3 className="text-[11px] text-dp-text-tertiary uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <MapPin size={12} /> Delivery Address
            </h3>
            {loadingMeta ? (
              <div className="h-12 bg-dp-bg-elevated rounded-sm animate-pulse" />
            ) : (
              <div className="flex flex-col gap-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAddr(a.id)}
                    className={`flex items-start gap-3 p-3 rounded-sm border text-left transition-colors ${
                      selectedAddr === a.id
                        ? "border-dp-accent-cta bg-dp-accent-cta/5"
                        : "border-dp-border hover:border-dp-border-hover bg-dp-bg-elevated"
                    }`}
                  >
                    <MapPin size={14} className={`mt-0.5 shrink-0 ${selectedAddr === a.id ? "text-dp-accent-cta" : "text-dp-text-tertiary"}`} />
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-dp-text-primary">{a.label}</p>
                      <p className="text-[12px] text-dp-text-secondary">
                        {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.zip_code}, {a.country}
                      </p>
                    </div>
                    {selectedAddr === a.id && <CheckCircle size={14} className="text-dp-accent-cta shrink-0 mt-0.5" />}
                  </button>
                ))}

                {/* Add address form */}
                {showAddAddr ? (
                  <div className="border border-dp-border rounded-sm p-4 bg-dp-bg-elevated flex flex-col gap-3">
                    <p className="text-[12px] font-semibold text-dp-text-primary">Add a delivery address</p>
                    <div className="flex gap-2">
                      <input
                        placeholder="Label (e.g. Home)"
                        value={addrLabel}
                        onChange={(e) => setAddrLabel(e.target.value)}
                        className="flex-1 px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                      />
                    </div>
                    <input
                      placeholder="Address line 1 *"
                      value={addrLine1}
                      onChange={(e) => setAddrLine1(e.target.value)}
                      className="px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder="City *"
                        value={addrCity}
                        onChange={(e) => setAddrCity(e.target.value)}
                        className="flex-1 px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                      />
                      <input
                        placeholder="State"
                        value={addrState}
                        onChange={(e) => setAddrState(e.target.value)}
                        className="w-24 px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                      />
                      <input
                        placeholder="ZIP *"
                        value={addrZip}
                        onChange={(e) => setAddrZip(e.target.value)}
                        className="w-24 px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                      />
                    </div>
                    <input
                      placeholder="Country"
                      value={addrCountry}
                      onChange={(e) => setAddrCountry(e.target.value)}
                      className="px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addAddress}
                        className="flex-1 py-2 bg-dp-accent-cta text-white text-[12px] font-bold uppercase rounded-sm hover:bg-dp-accent-cta-hover transition-colors"
                      >
                        Save Address
                      </button>
                      <button
                        onClick={() => { setShowAddAddr(false); setError("") }}
                        className="px-4 py-2 border border-dp-border text-[12px] text-dp-text-secondary rounded-sm hover:bg-dp-bg-elevated transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddAddr(true)}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-dp-border rounded-sm text-[12px] text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
                  >
                    <Plus size={14} /> Add an address
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <p className="text-[12px] text-dp-text-tertiary bg-dp-bg-elevated border border-dp-border rounded-sm p-3">
            You will only be charged if you win this auction. By confirming, you agree to complete payment
            for the winning bid amount.
          </p>

          {error && (
            <p className="flex items-center gap-1.5 text-[13px] text-dp-accent-cta">
              <AlertCircle size={14} /> {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-dp-border text-[13px] text-dp-text-secondary rounded-sm hover:bg-dp-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={placing}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors"
            >
              {placing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              {placing ? "Placing…" : `Confirm ${formatPrice(amount)} Bid`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bid history row ──────────────────────────────────────────────────────────

function BidRow({ bid, isTop, isNew }: { bid: ApiBid; isTop: boolean; isNew: boolean }) {
  const { formatPrice } = useLocale()
  const price = parseFloat(bid.amount)
  const ago = (() => {
    const diff = Date.now() - new Date(bid.placed_at).getTime()
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    return `${Math.floor(diff / 3_600_000)}h ago`
  })()

  return (
    <li
      className={`flex items-center justify-between px-4 py-3 border-b border-dp-border last:border-b-0 transition-colors ${
        isNew ? "bg-dp-accent-cta/10 animate-pulse" : isTop ? "bg-dp-accent-gold/5" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {isTop && <Trophy size={12} className="text-dp-accent-gold shrink-0" />}
        <span className={`text-[13px] font-semibold ${isTop ? "text-dp-accent-gold" : "text-dp-text-secondary"}`}>
          {bid.user_name}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className={`text-[14px] font-bold ${isTop ? "text-dp-accent-gold" : "text-dp-text-primary"}`}>
          {isNaN(price) ? "—" : formatPrice(price)}
        </span>
        <span className="text-[11px] text-dp-text-tertiary w-14 text-right">{ago}</span>
      </div>
    </li>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuctionDetailPage(): React.ReactElement {
  const params = useParams()
  const lookup = params?.id as string
  const localeParam = typeof params?.locale === "string" ? params.locale : ""
  const locale = isValidLocale(localeParam) ? localeParam : DEFAULT_LOCALE

  const { user } = useAuth()
  const { formatPrice } = useLocale()
  const [auction, setAuction] = useState<ApiAuction | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [auctionFaqs, setAuctionFaqs] = useState(AUCTION_FAQS)

  // Bidding UI state
  const [bidInput, setBidInput] = useState("")
  const [bidError, setBidError] = useState("")
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [bidSuccess, setBidSuccess] = useState(false)
  const [newBidIds, setNewBidIds] = useState<Set<number>>(new Set())

  // Track previous bid count to detect new bids from others during polling
  const prevBidCountRef = useRef(0)

  const fetchAuction = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await apiFetch<ApiAuction>(`/auctions/${lookup}/`)
      setAuction((prev) => {
        if (prev && data.bid_count > prevBidCountRef.current) {
          // Highlight the newest bids
          const existingIds = new Set(prev.recent_bids.map((b) => b.id))
          const freshIds = new Set(
            data.recent_bids.filter((b) => !existingIds.has(b.id)).map((b) => b.id)
          )
          if (freshIds.size > 0) {
            setNewBidIds(freshIds)
            setTimeout(() => setNewBidIds(new Set()), 3000)
          }
        }
        prevBidCountRef.current = data.bid_count
        return data
      })
    } catch {
      if (!silent) setNotFound(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [lookup])

  // Initial load
  useEffect(() => { fetchAuction() }, [fetchAuction])

  useEffect(() => {
    apiFetch<Array<{ id: number; question: string; answer: string }>>("/cms/faqs/?category=auction")
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setAuctionFaqs(data.map((f) => ({ q: f.question, a: f.answer })))
        }
      })
      .catch(() => {})
  }, [])

  // Live polling every 4 seconds while not ended
  useEffect(() => {
    if (!auction || auction.is_ended) return
    const interval = setInterval(() => fetchAuction(true), 4000)
    return () => clearInterval(interval)
  }, [auction, fetchAuction])

  const isUpcoming = Boolean(auction?.is_upcoming)
  const isBiddable = Boolean(auction?.is_biddable ?? auction?.is_live)

  function handleQuickBid(increment: number) {
    if (!auction) return
    const current = parseFloat(auction.current_bid)
    const val = current + increment
    setBidInput(val.toFixed(2))
    setBidError("")
  }

  function handlePlaceBid() {
    if (!getAccessToken()) {
      setShowLoginModal(true)
      return
    }
    if (!auction) return
    if (!isBiddable) {
      setBidError(isUpcoming
        ? `Bidding opens ${new Date(auction.starts_at).toLocaleString()}.`
        : "Bidding is not available for this auction.")
      return
    }
    const val = parseFloat(bidInput)
    const current = parseFloat(auction.current_bid)
    if (isNaN(val) || val <= current) {
      setBidError(`Bid must be higher than the current bid of ${formatPrice(current)}.`)
      return
    }
    if (val < current + 1) {
      setBidError(`Minimum increment is ${formatPrice(1)}. Enter at least ${formatPrice(current + 1)}.`)
      return
    }
    setBidError("")
    setPendingAmount(val)
    setShowConfirmModal(true)
  }

  function handleBidConfirmed(updated: ApiAuction) {
    setAuction(updated)
    prevBidCountRef.current = updated.bid_count
    setShowConfirmModal(false)
    setBidInput("")
    setBidSuccess(true)
    setTimeout(() => setBidSuccess(false), 4000)
  }

  const { d, h, m, s, done } = useCountdown(auction?.ends_at ?? new Date(0).toISOString())
  const startCountdown = useCountdown(auction?.starts_at ?? new Date(0).toISOString())
  const currentBid = auction ? parseFloat(auction.current_bid) : 0
  const img = auction?.effective_image || auction?.image_url || "/placeholder.svg"
  const urgent = !done && d === 0 && h === 0 && m < 10

  if (loading) {
    return (
      <SiteShell>
        <div className="dp-container py-10">
          <div className="animate-pulse flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/2 aspect-square bg-dp-bg-elevated rounded-sm" />
            <div className="flex-1 flex flex-col gap-4">
              <div className="h-6 bg-dp-bg-elevated rounded w-1/3" />
              <div className="h-10 bg-dp-bg-elevated rounded w-2/3" />
              <div className="h-16 bg-dp-bg-elevated rounded" />
              <div className="h-12 bg-dp-bg-elevated rounded" />
            </div>
          </div>
        </div>
      </SiteShell>
    )
  }

  if (notFound || !auction) {
    return (
      <SiteShell>
        <div className="dp-container py-24 text-center">
          <p className="font-display text-3xl text-dp-text-primary mb-2">Auction Not Found</p>
          <LocalizedLink href="/auctions" className="text-dp-accent-cta hover:underline text-[14px]">
            ← Back to Auctions
          </LocalizedLink>
        </div>
      </SiteShell>
    )
  }

  return (
    <SiteShell>
      {/* Modals */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false)
            // After login, pre-fill and show confirm modal
            if (pendingAmount > 0) setShowConfirmModal(true)
          }}
        />
      )}
      {showConfirmModal && (
        <BidConfirmModal
          auction={auction}
          amount={pendingAmount}
          onClose={() => setShowConfirmModal(false)}
          onConfirmed={handleBidConfirmed}
        />
      )}

      {/* Breadcrumb */}
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-3">
          <Breadcrumb
            locale={locale}
            items={[
              { name: "Home", url: "/" },
              { name: "Auctions", url: "/auctions" },
              { name: auction.title, url: `/auctions/${auction.slug || auction.id}` },
            ]}
          />
        </div>
      </div>

      <div className="dp-container py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">

          {/* ── Left: Image ─────────────────────────────────── */}
          <div className="lg:w-5/12 shrink-0">
            <div className="relative aspect-square rounded-sm overflow-hidden bg-dp-bg-elevated sticky top-24">
              <Image
                src={img}
                alt={auction.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              {/* Status overlay */}
              {auction.is_ended ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-white text-[13px] font-bold uppercase tracking-widest bg-black/70 px-4 py-2 rounded-sm">
                    Auction Ended
                  </span>
                </div>
              ) : isBiddable ? (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Live Auction
                </div>
              ) : isUpcoming ? (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm">
                  <Clock size={11} />
                  Starts Soon
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Right: Details + Bidding ─────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {/* Title */}
            <div>
              <p className="text-[11px] text-dp-text-tertiary uppercase tracking-[0.14em] mb-1">{auction.artist_name}</p>
              <h1 className="font-display text-4xl md:text-5xl text-dp-text-primary leading-none">{auction.title}</h1>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 border-y border-dp-border py-4">
              <div>
                <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Starting Bid</p>
                <p className="font-semibold text-dp-text-secondary">{formatPrice(parseFloat(auction.starting_bid))}</p>
              </div>
              <div>
                <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Total Bids</p>
                <p className="font-semibold text-dp-text-secondary flex items-center gap-1">
                  <Users size={12} /> {auction.bid_count}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Top Bidder</p>
                <p className="font-semibold text-dp-text-secondary flex items-center gap-1">
                  <Trophy size={12} className="text-dp-accent-gold" /> {auction.top_bidder}
                </p>
              </div>
            </div>

            {/* Current bid + countdown */}
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest mb-1">
                  {auction.is_ended ? "Final Bid" : "Current Bid"}
                </p>
                <p className="font-display text-6xl text-dp-accent-gold leading-none">
                  {formatPrice(currentBid)}
                </p>
              </div>
              {!auction.is_ended && isUpcoming && !startCountdown.done && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest mb-2 text-blue-500">Starts in</p>
                  <div className="flex gap-1.5">
                    {startCountdown.d > 0 && <CountdownBlock label="days" value={startCountdown.d} />}
                    <CountdownBlock label="hrs" value={startCountdown.h} />
                    <CountdownBlock label="min" value={startCountdown.m} />
                    <CountdownBlock label="sec" value={startCountdown.s} />
                  </div>
                  <p className="text-[11px] text-dp-text-tertiary mt-2">
                    Opens {new Date(auction.starts_at).toLocaleString()}
                  </p>
                </div>
              )}
              {!auction.is_ended && !isUpcoming && (
                <div>
                  <p className={`text-[11px] uppercase tracking-widest mb-2 ${urgent ? "text-dp-accent-cta" : "text-dp-text-tertiary"}`}>
                    {done ? "Auction ended" : "Ends in"}
                  </p>
                  {!done && (
                    <div className="flex gap-1.5">
                      {d > 0 && <CountdownBlock label="days" value={d} />}
                      <CountdownBlock label="hrs" value={h} />
                      <CountdownBlock label="min" value={m} />
                      <CountdownBlock label="sec" value={s} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bid success banner */}
            {bidSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-sm text-green-700 text-[13px] font-semibold">
                <CheckCircle size={16} />
                Bid placed successfully! You&apos;re the top bidder.
              </div>
            )}

            {/* Bidding panel */}
            {!auction.is_ended && (
              <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 flex flex-col gap-4">
                <h2 className="font-display text-xl text-dp-text-primary">Place Your Bid</h2>

                {isUpcoming && !isBiddable ? (
                  <p className="text-[13px] text-dp-text-secondary">
                    This auction is scheduled. Bidding opens on{" "}
                    <strong>{new Date(auction.starts_at).toLocaleString()}</strong>.
                  </p>
                ) : (
                  <>
                {/* Quick-bid buttons */}
                <div className="flex flex-wrap gap-2">
                  {[3, 5, 10].map((inc) => (
                    <button
                      key={inc}
                      onClick={() => handleQuickBid(inc)}
                      className="px-4 py-2 bg-dp-bg-elevated border border-dp-border text-dp-text-primary text-[13px] font-semibold rounded-sm hover:border-dp-accent-cta hover:text-dp-accent-cta transition-colors"
                    >
                      {formatPrice(currentBid + inc)}
                      <span className="ml-1 text-[10px] text-dp-text-tertiary">+${inc}</span>
                    </button>
                  ))}
                </div>

                {/* Custom bid input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary text-sm font-semibold">$</span>
                    <input
                      type="number"
                      value={bidInput}
                      onChange={(e) => { setBidInput(e.target.value); setBidError("") }}
                      placeholder={`${(currentBid + 1).toFixed(2)} or more`}
                      min={currentBid + 1}
                      step={1}
                      className="w-full pl-7 pr-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary text-[14px] placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-accent-cta transition-colors"
                    />
                  </div>
                  <button
                    onClick={handlePlaceBid}
                    className="flex items-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors shrink-0"
                  >
                    <Zap size={15} />
                    {user ? "Place Bid" : "Log In to Bid"}
                  </button>
                </div>

                {bidError && (
                  <p className="flex items-center gap-1.5 text-[12px] text-dp-accent-cta">
                    <AlertCircle size={13} /> {bidError}
                  </p>
                )}

                {!user && (
                  <p className="flex items-center gap-1.5 text-[12px] text-dp-text-tertiary">
                    <Lock size={12} />
                    You must be logged in to bid. Your bid will be saved.
                  </p>
                )}

                <p className="text-[11px] text-dp-text-tertiary">
                  Min increment: $1.00 · Bids are binding · Winner pays within 48h
                </p>
                  </>
                )}
              </div>
            )}

            {isBiddable && <AuctionLiveChat auctionId={auction.id} isLive={isBiddable} />}

            {/* Bid history */}
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-dp-border flex items-center justify-between">
                <h3 className="font-display text-xl text-dp-text-primary">Bid History</h3>
                <span className="text-[12px] text-dp-text-tertiary flex items-center gap-1">
                  {!auction.is_ended && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-dp-accent-cta animate-pulse" />
                      Live
                    </>
                  )}
                </span>
              </div>
              {auction.recent_bids.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-dp-text-tertiary">No bids yet — be the first!</p>
              ) : (
                <ul>
                  {auction.recent_bids.map((bid, i) => (
                    <BidRow
                      key={bid.id}
                      bid={bid}
                      isTop={i === 0}
                      isNew={newBidIds.has(bid.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="border-t border-dp-border bg-dp-bg-elevated py-12" aria-labelledby="auction-faq-heading">
        <div className="dp-container max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">FAQ</p>
          <h2 id="auction-faq-heading" className="font-display text-3xl md:text-4xl text-dp-text-primary mb-6">
            Auction Questions
          </h2>
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm px-5 sm:px-6">
            {auctionFaqs.map((faq) => (
              <AuctionFaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
