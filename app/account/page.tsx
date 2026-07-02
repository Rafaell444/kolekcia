"use client"

import React, { useState, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import Link from "next/link"
import {
  Package, Heart, Star, Settings, LogOut, ChevronRight,
  Truck, CheckCircle2, Clock, XCircle, RotateCcw,
  Award, Zap, ShoppingBag, User, MapPin, BellRing, MessageSquare,
  Lock, Plus, Pencil, Trash2, Home, Building2,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useGamification } from "@/contexts/gamification-context"
import { useRouter } from "next/navigation"
import { authFetch, apiFetch, parseList, type PaginatedResponse } from "@/lib/api"
import { useLocale } from "@/contexts/locale-context"
import { productHref } from "@/lib/product-url"
import InboxPanel from "@/components/messaging/InboxPanel"
import { UnreadBadge } from "@/components/messaging/UnreadBadge"
import { useInboxUnreadCount } from "@/hooks/use-inbox-unread"

type Order = { id: string; order_number: string; status: string; total: string; created_at: string; items_count: number; tracking_code: string }
type Badge = { id: string; name: string; icon: string; rarity: string; description: string }
type EarnedBadge = { badge: Badge; earned_at: string }
type WishlistItem = { id: string; product_id: number; product_slug?: string; title: string; base_price: string; image_url: string; artist_name: string }
type Address = { id: number; label: string; line1: string; line2: string; city: string; state: string; zip_code: string; country: string; is_default: boolean }
type XPLog = { id: number; action: string; xp_amount: number; created_at: string }
type XPRule = { id: number; action_key: string; xp_amount: number; is_one_time: boolean }
type ReferralStats = { code: string; total_invites: number; converted_invites: number }

const ACCOUNT_TABS = [
  { id: "overview",      label: "Overview",       Icon: User },
  { id: "inbox",         label: "Inbox",          Icon: MessageSquare },
  { id: "orders",        label: "Orders",         Icon: Package },
  { id: "wishlist",      label: "Wishlist",       Icon: Heart },
  { id: "badges",        label: "Badges & XP",    Icon: Award },
  { id: "settings",      label: "Settings",       Icon: Settings },
  { id: "addresses",     label: "Addresses",      Icon: MapPin },
]

const ORDER_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  delivered:  { label: "Delivered",  icon: <CheckCircle2 size={13} />, color: "text-dp-success" },
  shipped:    { label: "Shipped",    icon: <Truck size={13} />,        color: "text-dp-accent-gold" },
  processing: { label: "Processing", icon: <Clock size={13} />,        color: "text-dp-text-secondary" },
  pending:    { label: "Pending",    icon: <Clock size={13} />,        color: "text-dp-text-tertiary" },
  cancelled:  { label: "Cancelled",  icon: <XCircle size={13} />,      color: "text-dp-accent-cta" },
}

// ── Level XP roadmap data ──────────────────────────────────
const LEVEL_ROADMAP = [
  { level: 1,  minXp: 0,     maxXp: 149,   perks: ["Access to community forum", "Basic XP earning"] },
  { level: 2,  minXp: 150,   maxXp: 299,   perks: ["5% off your next order", "Early sale notifications"] },
  { level: 3,  minXp: 300,   maxXp: 599,   perks: ["Free standard shipping on 1 order/month", "Priority support"] },
  { level: 4,  minXp: 600,   maxXp: 999,   perks: ["Unlock rare badges", "10% off limited editions"] },
  { level: 5,  minXp: 1000,  maxXp: 1499,  perks: ["15% discount coupon", "VIP newsletter access"] },
  { level: 6,  minXp: 1500,  maxXp: 1999,  perks: ["Free express shipping", "Custom order priority"] },
  { level: 7,  minXp: 2000,  maxXp: 2999,  perks: ["20% discount on any order", "Early access to drops"] },
  { level: 8,  minXp: 3000,  maxXp: 4499,  perks: ["Exclusive collector badge", "Monthly mystery gift"] },
  { level: 9,  minXp: 4500,  maxXp: 9999,  perks: ["25% off all orders", "VIP event invitations"] },
  { level: 10, minXp: 10000, maxXp: Infinity, perks: ["Legendary status", "30% off lifetime discount", "Direct artist contact"] },
]

function OverviewTab() {
  const { profile } = useGamification()
  const { formatPrice } = useLocale()
  const [orders, setOrders] = useState<Order[]>([])
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([])
  const [referral, setReferral] = useState<ReferralStats | null>(null)
  const [xpLog, setXpLog] = useState<XPLog[]>([])
  const [xpRules, setXpRules] = useState<XPRule[]>([])

  useEffect(() => {
    let cancelled = false
    authFetch<{ results: Order[] }>("/orders/").then((d) => { if (!cancelled) setOrders(d.results.slice(0, 3)) }).catch(() => {})
    authFetch<EarnedBadge[]>("/gamification/my-badges/").then((d) => { if (!cancelled) setEarnedBadges(d.slice(0, 6)) }).catch(() => {})
    authFetch<ReferralStats>("/referrals/me/").then((d) => { if (!cancelled) setReferral(d) }).catch(() => {})
    authFetch<XPLog[] | PaginatedResponse<XPLog>>("/gamification/xp-log/")
      .then((d) => { if (!cancelled) setXpLog(parseList(d).slice(0, 4)) })
      .catch(() => {})
    apiFetch<XPRule[]>("/gamification/xp-rules/").then((d) => { if (!cancelled) setXpRules((Array.isArray(d) ? d : []).slice(0, 4)) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const xp = profile?.xp ?? 0
  const level = profile?.level ?? 1
  const nextLevelInfo = LEVEL_ROADMAP.find((l) => l.level === level + 1)
  const nextLevelXp = nextLevelInfo?.minXp ?? (level * 500)
  const progress = level >= 10 ? 100 : Math.min(100, Math.round((xp / nextLevelXp) * 100))

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-gold mb-0.5">Level {level}</p>
            <p className="font-display text-3xl text-dp-text-primary">{xp.toLocaleString()} XP</p>
          </div>
          <div className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-dp-accent-gold">
            <Zap size={20} className="text-dp-accent-gold" />
          </div>
        </div>
        <div className="w-full bg-dp-bg-elevated rounded-full h-2 overflow-hidden">
          <div className="h-full bg-dp-accent-gold rounded-full transition-all duration-700" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={xp} aria-valuemax={nextLevelXp} aria-label="XP progress" />
        </div>
        {level < 10 && <p className="text-[11px] text-dp-text-tertiary mt-2">{nextLevelXp - xp} XP until Level {level + 1}</p>}
        {level >= 10 && <p className="text-[11px] text-dp-accent-gold mt-2 font-bold">Maximum level reached — Legendary Collector!</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: ShoppingBag, label: "Total Orders",  value: orders.length },
          { icon: Award,       label: "Badges Earned", value: earnedBadges.length },
          { icon: Star,        label: "Streak Days",   value: profile?.streak_days ?? 0 },
          { icon: Heart,       label: "Points",        value: profile?.points ?? 0 },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-dp-bg-surface border border-dp-border rounded-sm p-4 flex flex-col gap-1">
            <Icon size={16} className="text-dp-text-tertiary" />
            <p className="font-display text-3xl text-dp-text-primary">{value}</p>
            <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">XP History</h3>
          <div className="space-y-1.5">
            {xpLog.length > 0 ? xpLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-[11px]">
                <span className="text-dp-text-secondary truncate pr-3">{entry.action.replaceAll("_", " ")}</span>
                <span className="font-bold text-dp-accent-cta shrink-0">+{entry.xp_amount}</span>
              </div>
            )) : <p className="text-[11px] text-dp-text-tertiary">No XP activity yet.</p>}
          </div>
        </div>
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">How To Earn XP</h3>
          <div className="space-y-1.5">
            {xpRules.length > 0 ? xpRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between text-[11px]">
                <span className="text-dp-text-secondary truncate pr-3">{rule.action_key.replaceAll("_", " ")}</span>
                <span className="font-bold text-dp-success shrink-0">{rule.xp_amount}</span>
              </div>
            )) : <p className="text-[11px] text-dp-text-tertiary">XP rules unavailable.</p>}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-dp-text-primary">Recent Orders</h2>
          <button className="text-[11px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors flex items-center gap-1">View all <ChevronRight size={11} /></button>
        </div>
        {orders.length === 0 ? (
          <p className="text-[13px] text-dp-text-tertiary py-4">No orders yet. <Link href="/catalog" className="text-dp-accent-cta hover:underline">Shop now</Link></p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => {
              const cfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.pending
              return (
                <div key={order.id} className="bg-dp-bg-surface border border-dp-border rounded-sm p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[13px] font-bold text-dp-text-primary">{order.order_number}</p>
                    <p className="text-[11px] text-dp-text-tertiary">{order.items_count} item{order.items_count !== 1 ? "s" : ""} · {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${cfg.color}`}>{cfg.icon} {cfg.label}</div>
                  <span className="font-bold text-dp-text-primary text-[14px]">{formatPrice(parseFloat(order.total))}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {earnedBadges.length > 0 && (
        <div>
          <h2 className="font-display text-2xl text-dp-text-primary mb-4">Recent Badges</h2>
          <div className="flex gap-3 flex-wrap">
            {earnedBadges.map(({ badge, earned_at }) => (
              <div key={badge.id} className="flex flex-col items-center gap-1.5 px-4 py-3 bg-dp-bg-surface border border-dp-accent-gold/40 rounded-sm" title={`Earned ${new Date(earned_at).toLocaleDateString()}`}>
                <span className="text-2xl" aria-hidden>{badge.icon}</span>
                <span className="text-[11px] font-bold text-dp-text-primary text-center">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {referral && (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <h2 className="font-display text-2xl text-dp-text-primary mb-3">Referral Program</h2>
          <p className="text-[12px] text-dp-text-secondary mb-3">
            Share your link. When a friend buys for the first time, both of you earn XP.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <code className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/?ref=${referral.code}` : `/?ref=${referral.code}`}
            </code>
          </div>
          <p className="text-[12px] text-dp-text-tertiary mt-3">
            Invites: {referral.total_invites} · Conversions: {referral.converted_invites}
          </p>
        </div>
      )}
    </div>
  )
}

function OrdersTab() {
  const { formatPrice } = useLocale()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authFetch<{ results: Order[] }>("/orders/").then((d) => { if (!cancelled) setOrders(d.results) }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-3xl text-dp-text-primary">My Orders</h2>
      {loading ? (
        <div className="animate-pulse space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24">
          <Package size={40} className="text-dp-text-tertiary" />
          <p className="text-dp-text-secondary text-[14px]">No orders yet.</p>
          <Link
            href="/catalog"
            className="px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
          >
            Shop Now
          </Link>
        </div>
      ) : orders.map((order) => {
        const cfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.pending
        return (
          <div key={order.id} className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[13px] font-bold text-dp-text-primary">{order.order_number}</p>
                <p className="text-[11px] text-dp-text-tertiary mt-0.5">{new Date(order.created_at).toLocaleDateString()} · {order.items_count} item{order.items_count !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${cfg.color}`}>{cfg.icon} {cfg.label}</div>
                <span className="font-display text-xl text-dp-text-primary">{formatPrice(parseFloat(order.total))}</span>
              </div>
            </div>
            {order.tracking_code && (
              <p className="text-[11px] text-dp-text-tertiary">Tracking: <span className="font-mono text-dp-text-secondary">{order.tracking_code}</span></p>
            )}
            <div className="flex gap-2 mt-3">
              <Link href={`/account/orders/${order.id}`} className="px-4 py-1.5 border border-dp-border rounded-sm text-[11px] font-bold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">View Details</Link>
              {order.status === "delivered" && (
                <button className="flex items-center gap-1 px-4 py-1.5 border border-dp-border rounded-sm text-[11px] font-bold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
                  <RotateCcw size={11} /> Return
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WishlistTab() {
  const { formatPrice } = useLocale()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authFetch<WishlistItem[] | { results: WishlistItem[] }>("/products/wishlist/")
      .then((d) => { if (!cancelled) setItems((Array.isArray(d) ? d : (d.results ?? [])).slice(0, 8)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <h2 className="font-display text-3xl text-dp-text-primary mb-6">My Wishlist</h2>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">{[1,2,3,4].map((i) => <div key={i} className="aspect-poster bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => (
            <Link key={p.id} href={productHref({ id: p.product_id, slug: p.product_slug })} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover">
              <div className="aspect-poster relative bg-dp-bg-elevated">
                {p.image_url && <Image src={p.image_url} alt={p.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 25vw" />}
              </div>
              <div className="p-3">
                <p className="text-[10px] text-dp-text-tertiary truncate">{p.artist_name}</p>
                <p className="text-[13px] font-semibold text-dp-text-primary truncate">{p.title}</p>
                <p className="text-[14px] font-bold text-dp-text-primary mt-1">{formatPrice(parseFloat(p.base_price))}</p>
              </div>
            </Link>
          ))}
          {items.length === 0 && (
            <div className="col-span-4 flex flex-col items-center gap-4 py-16 text-dp-text-tertiary">
              <Heart size={40} className="opacity-30" />
              <p className="text-[13px]">No saved items yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BadgesTab() {
  const { profile } = useGamification()
  const [badges, setBadges] = useState<Badge[]>([])
  const [earned, setEarned] = useState<string[]>([])
  const [xpLog, setXpLog] = useState<XPLog[]>([])
  const [xpRules, setXpRules] = useState<XPRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showRoadmap, setShowRoadmap] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch<Badge[]>("/gamification/badges/").catch(() => []),
      authFetch<EarnedBadge[]>("/gamification/my-badges/").then((d) => d.map((b) => b.badge.id)).catch(() => []),
      authFetch<XPLog[] | PaginatedResponse<XPLog>>("/gamification/xp-log/").catch(() => []),
      apiFetch<XPRule[]>("/gamification/xp-rules/").catch(() => []),
    ]).then(([b, e, logs, rules]) => {
      if (!cancelled) {
        setBadges(b)
        setEarned(e)
        setXpLog(parseList(logs).slice(0, 10))
        setXpRules(Array.isArray(rules) ? rules.slice(0, 10) : [])
      }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const rarityColor: Record<string, string> = { common: "border-dp-border", rare: "border-blue-400/50", epic: "border-purple-400/50", legendary: "border-dp-accent-gold/70" }

  const xp = profile?.xp ?? 0
  const level = profile?.level ?? 1

  return (
    <div className="flex flex-col gap-8">
      {/* Badges grid */}
      <div>
        <h2 className="font-display text-3xl text-dp-text-primary mb-2">Badges &amp; XP</h2>
        <p className="text-[13px] text-dp-text-tertiary mb-6">Complete challenges to earn badges and level up your collector status.</p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">{[1,2,3,4].map((i) => <div key={i} className="h-28 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {badges.map((badge) => {
              const unlocked = earned.includes(badge.id)
              return (
                <div
                  key={badge.id}
                  className={`relative flex flex-col items-center gap-2 p-4 bg-dp-bg-surface border rounded-sm transition-all ${rarityColor[badge.rarity] ?? rarityColor.common} ${unlocked ? "opacity-100" : "opacity-50 grayscale"}`}
                >
                  {!unlocked && (
                    <div className="absolute top-2 right-2">
                      <Lock size={12} className="text-dp-text-tertiary" />
                    </div>
                  )}
                  <span className="text-3xl" aria-hidden>{badge.icon}</span>
                  <p className="text-[12px] font-bold text-dp-text-primary text-center">{badge.name}</p>
                  <p className="text-[10px] text-dp-text-tertiary text-center leading-snug">{badge.description}</p>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.rarity === "legendary" ? "bg-dp-accent-gold/20 text-dp-accent-gold" : badge.rarity === "epic" ? "bg-purple-500/20 text-purple-400" : badge.rarity === "rare" ? "bg-blue-500/20 text-blue-400" : "bg-dp-bg-elevated text-dp-text-tertiary"}`}>
                    {unlocked ? badge.rarity : `Locked · ${badge.rarity}`}
                  </span>
                </div>
              )
            })}
            {badges.length === 0 && !loading && (
              <div className="col-span-4 py-12 text-center text-dp-text-tertiary text-[13px]">
                No badges available yet. Keep collecting XP!
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-4">XP History</h3>
          <div className="space-y-2">
            {xpLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-[12px]">
                <span className="text-dp-text-secondary">{entry.action.replaceAll("_", " ")}</span>
                <span className="font-bold text-dp-accent-cta">+{entry.xp_amount} XP</span>
              </div>
            ))}
            {xpLog.length === 0 && <p className="text-[12px] text-dp-text-tertiary">No XP activity yet.</p>}
          </div>
        </div>
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-4">How To Earn XP</h3>
          <div className="space-y-2">
            {xpRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between text-[12px]">
                <span className="text-dp-text-secondary">{rule.action_key.replaceAll("_", " ")}</span>
                <span className="font-bold text-dp-success">{rule.xp_amount} XP</span>
              </div>
            ))}
            {xpRules.length === 0 && <p className="text-[12px] text-dp-text-tertiary">XP rules unavailable.</p>}
          </div>
        </div>
      </div>

      {/* Level XP Roadmap */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-dp-text-primary">Level Roadmap</h2>
          <button
            onClick={() => setShowRoadmap((o) => !o)}
            className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors"
          >
            {showRoadmap ? "Hide" : "Show all levels"}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {LEVEL_ROADMAP.filter((l) => showRoadmap || Math.abs(l.level - level) <= 2).map((l) => {
            const isCurrent = l.level === level
            const isPast = l.level < level
            return (
              <div
                key={l.level}
                className={`flex items-start gap-4 p-4 rounded-sm border transition-colors ${
                  isCurrent
                    ? "border-dp-accent-gold bg-dp-accent-gold/5"
                    : isPast
                    ? "border-dp-border bg-dp-bg-elevated opacity-60"
                    : "border-dp-border bg-dp-bg-surface"
                }`}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 font-display text-lg ${isCurrent ? "bg-dp-accent-gold text-dp-bg-base" : isPast ? "bg-dp-bg-elevated text-dp-text-tertiary" : "bg-dp-bg-elevated text-dp-text-secondary"}`}>
                  {l.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[13px] font-bold ${isCurrent ? "text-dp-accent-gold" : "text-dp-text-primary"}`}>
                      Level {l.level}
                      {isCurrent && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest bg-dp-accent-gold text-dp-bg-base px-2 py-0.5 rounded-full">Current</span>}
                    </p>
                    <p className="text-[11px] text-dp-text-tertiary">
                      {l.level < 10 ? `${l.minXp.toLocaleString()} – ${l.maxXp.toLocaleString()} XP` : `${l.minXp.toLocaleString()}+ XP`}
                    </p>
                  </div>
                  {isCurrent && (
                    <div className="mt-1.5 w-full bg-dp-bg-elevated rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-dp-accent-gold rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round(((xp - l.minXp) / (l.maxXp - l.minXp)) * 100))}%` }}
                      />
                    </div>
                  )}
                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {l.perks.map((perk) => (
                      <li key={perk} className={`text-[11px] flex items-center gap-1 ${isCurrent || isPast ? "text-dp-text-secondary" : "text-dp-text-tertiary"}`}>
                        <CheckCircle2 size={10} className={isPast ? "text-dp-success" : isCurrent ? "text-dp-accent-gold" : "text-dp-text-tertiary"} />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Addresses Tab ─────────────────────────────────────────
const EMPTY_ADDR: Omit<Address, "id"> = { label: "Home", line1: "", line2: "", city: "", state: "", zip_code: "", country: "US", is_default: false }

function AddressesTab() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Address | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Omit<Address, "id">>(EMPTY_ADDR)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    authFetch<Address[]>("/auth/addresses/")
      .then((d) => { if (!cancelled) setAddresses(Array.isArray(d) ? d : (d as { results: Address[] }).results ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function openAdd() { setForm(EMPTY_ADDR); setEditing(null); setAdding(true) }
  function openEdit(addr: Address) { setForm({ label: addr.label, line1: addr.line1, line2: addr.line2, city: addr.city, state: addr.state, zip_code: addr.zip_code, country: addr.country, is_default: addr.is_default }); setEditing(addr); setAdding(true) }
  function closeForm() { setAdding(false); setEditing(null) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const updated = await authFetch<Address>(`/auth/addresses/${editing.id}/`, { method: "PATCH", body: JSON.stringify(form) })
        setAddresses((prev) => prev.map((a) => a.id === editing.id ? updated : a))
      } else {
        const created = await authFetch<Address>("/auth/addresses/", { method: "POST", body: JSON.stringify(form) })
        setAddresses((prev) => [...prev, created])
      }
      closeForm()
    } catch {
      // keep form open on error
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await authFetch(`/auth/addresses/${id}/`, { method: "DELETE" }).catch(() => {})
    setAddresses((prev) => prev.filter((a) => a.id !== id))
  }

  const inputCls = "w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
  const labelCls = "block text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary mb-1.5"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl text-dp-text-primary">Addresses</h2>
        {!adding && (
          <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] font-black uppercase tracking-widest rounded-sm transition-colors">
            <Plus size={13} /> Add Address
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {adding && (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
          <h3 className="font-display text-xl text-dp-text-primary mb-5">{editing ? "Edit Address" : "New Address"}</h3>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Label</label>
              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((lbl) => (
                  <button key={lbl} type="button" onClick={() => setForm((f) => ({ ...f, label: lbl }))}
                    className={`px-3 py-1.5 rounded-sm text-[11px] font-bold border transition-colors ${form.label === lbl ? "bg-dp-accent-cta text-white border-dp-accent-cta" : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"}`}>
                    {lbl === "Home" ? <><Home size={11} className="inline mr-1" />Home</> : lbl === "Work" ? <><Building2 size={11} className="inline mr-1" />Work</> : lbl}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Address Line 1 *</label>
              <input required value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} placeholder="Street address" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Address Line 2</label>
              <input value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} placeholder="Apt, suite, etc. (optional)" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City *</label>
              <input required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="City" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State / Region</label>
              <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="State" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Postal Code *</label>
              <input required value={form.zip_code} onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))} placeholder="ZIP / Postal" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country *</label>
              <input required value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Country" className={inputCls} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="is_default" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4 rounded" />
              <label htmlFor="is_default" className="text-[13px] text-dp-text-secondary">Set as default address</label>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Address"}
              </button>
              <button type="button" onClick={closeForm} className="px-6 py-2.5 border border-dp-border rounded-sm text-[12px] font-bold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Address list */}
      {loading ? (
        <div className="animate-pulse space-y-3">{[1,2].map((i) => <div key={i} className="h-24 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : addresses.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-4 py-16 text-dp-text-tertiary">
          <MapPin size={40} className="opacity-30" />
          <p className="text-[13px]">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div key={addr.id} className={`relative bg-dp-bg-surface border rounded-sm p-5 ${addr.is_default ? "border-dp-accent-gold" : "border-dp-border"}`}>
              {addr.is_default && <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest bg-dp-accent-gold/20 text-dp-accent-gold px-2 py-0.5 rounded-full">Default</span>}
              <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">{addr.label}</p>
              <p className="text-[13px] text-dp-text-primary">{addr.line1}</p>
              {addr.line2 && <p className="text-[13px] text-dp-text-secondary">{addr.line2}</p>}
              <p className="text-[13px] text-dp-text-secondary">{addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.zip_code}</p>
              <p className="text-[13px] text-dp-text-secondary">{addr.country}</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openEdit(addr)} className="flex items-center gap-1 px-3 py-1.5 border border-dp-border rounded-sm text-[11px] font-bold text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
                  <Pencil size={11} /> Edit
                </button>
                <button onClick={() => handleDelete(addr.id)} className="flex items-center gap-1 px-3 py-1.5 border border-dp-border rounded-sm text-[11px] font-bold text-dp-text-secondary hover:text-dp-accent-cta hover:border-dp-accent-cta/50 transition-colors">
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────
function SettingsTab() {
  const { user, refreshUser } = useAuth()
  const [nameParts, setNameParts] = useState(() => {
    const parts = (user?.name ?? "").split(" ")
    return { first: parts[0] ?? "", last: parts.slice(1).join(" ") }
  })
  const [phone, setPhone] = useState((user as (typeof user & { phone?: string }))?.phone ?? "")
  const [dob, setDob] = useState((user as (typeof user & { date_of_birth?: string }))?.date_of_birth ?? "")
  const [savedInfo, setSavedInfo] = useState(false)

  const [curPw, setCurPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [newPw2, setNewPw2] = useState("")
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    setSavingInfo(true)
    try {
      await authFetch("/auth/me/", {
        method: "PATCH",
        body: JSON.stringify({
          name: `${nameParts.first} ${nameParts.last}`.trim(),
          phone,
          date_of_birth: dob || null,
        }),
      })
      await refreshUser()
      setSavedInfo(true)
      setTimeout(() => setSavedInfo(false), 2500)
    } catch {
      // silent fail for now
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError("")
    if (newPw !== newPw2) { setPwError("New passwords do not match."); return }
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return }
    setSavingPw(true)
    try {
      await authFetch("/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({ current_password: curPw, new_password: newPw, new_password2: newPw2 }),
      })
      setPwSuccess(true)
      setCurPw(""); setNewPw(""); setNewPw2("")
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err: unknown) {
      const e = err as { data?: Record<string, string[]> }
      if (e?.data?.current_password) setPwError(e.data.current_password[0])
      else setPwError("Failed to change password. Please try again.")
    } finally {
      setSavingPw(false)
    }
  }

  const inputCls = "w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
  const labelCls = "block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2"

  return (
    <div className="flex flex-col gap-10 max-w-lg">
      <h2 className="font-display text-3xl text-dp-text-primary">Account Settings</h2>

      {/* Personal Information */}
      <section>
        <h3 className="font-display text-xl text-dp-text-primary mb-5">Personal Information</h3>
        <form className="flex flex-col gap-5" onSubmit={handleSaveInfo}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name</label>
              <input value={nameParts.first} onChange={(e) => setNameParts((p) => ({ ...p, first: e.target.value }))} placeholder="Jane" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input value={nameParts.last} onChange={(e) => setNameParts((p) => ({ ...p, last: e.target.value }))} placeholder="Doe" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" value={user?.email ?? ""} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
            <p className="text-[11px] text-dp-text-tertiary mt-1">Email cannot be changed. Contact support if needed.</p>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={savingInfo} className={`self-start px-8 py-3 rounded-sm text-[12px] font-black uppercase tracking-widest transition-colors disabled:opacity-60 ${savedInfo ? "bg-dp-success text-white" : "bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white"}`}>
            {savingInfo ? "Saving…" : savedInfo ? "Saved!" : "Save Changes"}
          </button>
        </form>
      </section>

      <div className="border-t border-dp-border" />

      {/* Change Password */}
      <section>
        <h3 className="font-display text-xl text-dp-text-primary mb-5">Change Password</h3>
        <form className="flex flex-col gap-5" onSubmit={handleChangePassword}>
          <div>
            <label className={labelCls}>Current Password</label>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Enter current password" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>New Password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 characters" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="Re-enter new password" className={inputCls} />
          </div>
          {pwError && <p className="text-[12px] text-dp-accent-cta">{pwError}</p>}
          {pwSuccess && <p className="text-[12px] text-dp-success">Password changed successfully!</p>}
          <button type="submit" disabled={savingPw} className="self-start px-8 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
            {savingPw ? "Updating…" : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  )
}

function InboxTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl text-dp-text-primary">Inbox</h2>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Your conversations with artists and sellers.</p>
      </div>
      <InboxPanel embedded autoSelectFirst={false} />
    </div>
  )
}

export default function AccountPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState("overview")
  const { user, logout } = useAuth()
  const { profile } = useGamification()
  const router = useRouter()
  const inboxUnread = useInboxUnreadCount()

  async function handleLogout() {
    await logout()
    router.push("/login")
  }

  const tabContent: Record<string, React.ReactNode> = {
    overview:      <OverviewTab />,
    inbox:         <InboxTab />,
    orders:        <OrdersTab />,
    wishlist:      <WishlistTab />,
    badges:        <BadgesTab />,
    settings:      <SettingsTab />,
    addresses:     <AddressesTab />,
  }

  const displayName = user?.name || user?.email || "Account"

  return (
    <SiteShell>
      <div className="bg-dp-bg-surface border-b border-dp-border">
        <div className="dp-container py-6 md:py-8 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full">
            {user?.avatar ? (
              <Image src={user.avatar} alt={displayName} width={64} height={64} className="rounded-full border-2 border-dp-accent-gold shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-dp-bg-elevated border-2 border-dp-accent-gold flex items-center justify-center shrink-0">
                <User size={28} className="text-dp-text-tertiary" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl text-dp-text-primary truncate">{displayName}</h1>
                <p className="text-[12px] text-dp-text-tertiary mt-0.5">Level {profile?.level ?? 1} · {(profile?.xp ?? 0).toLocaleString()} XP</p>
              </div>
              <Link
                href={inboxUnread > 0 ? "/inbox" : "/account/notifications"}
                className="relative shrink-0 flex items-center justify-center w-9 h-9 rounded-sm border border-dp-border text-dp-text-secondary hover:text-dp-accent-cta hover:border-dp-border-hover transition-colors"
                aria-label={inboxUnread > 0 ? `${inboxUnread} unread messages` : "Notifications"}
              >
                <BellRing size={16} strokeWidth={1.75} />
                {inboxUnread > 0 && (
                  <span className="absolute -top-1 -right-1">
                    <UnreadBadge count={inboxUnread} />
                  </span>
                )}
              </Link>
            </div>
          </div>
          <button onClick={handleLogout} className="self-end sm:self-center shrink-0 flex items-center gap-1.5 text-[11px] text-dp-text-tertiary hover:text-dp-accent-cta transition-colors sm:ml-2">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      <div className="dp-container py-6 md:py-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        <div className="md:hidden w-full overflow-x-auto flex gap-2 pb-1 -mx-1 px-1">
          {ACCOUNT_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`shrink-0 px-3 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === id ? "bg-dp-accent-cta text-white" : "bg-dp-bg-surface border border-dp-border text-dp-text-secondary hover:text-dp-text-primary"}`}>
              {label}
              {id === "inbox" && <UnreadBadge count={inboxUnread} />}
            </button>
          ))}
        </div>

        <aside className="hidden md:flex flex-col w-52 shrink-0 gap-1" aria-label="Account navigation">
          {ACCOUNT_TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-sm text-[13px] font-medium text-left transition-colors w-full ${activeTab === id ? "bg-dp-bg-elevated text-dp-text-primary" : "text-dp-text-secondary hover:bg-dp-bg-elevated hover:text-dp-text-primary"}`}
              aria-current={activeTab === id ? "page" : undefined}>
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon size={14} className={activeTab === id ? "text-dp-accent-cta" : "text-dp-text-tertiary"} />
                {label}
              </span>
              {id === "inbox" && <UnreadBadge count={inboxUnread} />}
            </button>
          ))}
        </aside>

        <main className="flex-1 min-w-0 w-full">{tabContent[activeTab]}</main>
      </div>
    </SiteShell>
  )
}
