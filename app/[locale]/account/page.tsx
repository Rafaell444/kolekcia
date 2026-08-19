"use client"

import React, { useState, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import Link from "next/link"
import {
  Package, Heart, Star, Settings, LogOut, ChevronRight,
  Truck, CheckCircle2, Clock, XCircle, RotateCcw,
  Award, ShoppingBag, User, MapPin, BellRing, MessageSquare,
  Plus, Pencil, Trash2, Home, Building2, FileText, ExternalLink, CreditCard, Check,
  Megaphone,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useGamification } from "@/contexts/gamification-context"
import { useRouter, useSearchParams } from "next/navigation"
import { authFetch, parseList, type PaginatedResponse } from "@/lib/api"
import { useLocale } from "@/contexts/locale-context"
import { formatAmount } from "@/lib/product-pricing"
import type { Currency } from "@/contexts/locale-context"
import { productHref } from "@/lib/product-url"
import { useLocalePrefix } from "@/lib/use-localized-href"
import InboxPanel from "@/components/messaging/InboxPanel"
import { UnreadBadge } from "@/components/messaging/UnreadBadge"
import { useInboxUnreadCount } from "@/hooks/use-inbox-unread"
import CreatorPanel from "@/components/account/CreatorPanel"
import { CHECKOUT_COUNTRIES, countryName } from "@/lib/countries"
import { getAccessToken } from "@/lib/auth-storage"

type CustomOrder = {
  id: string; vendor_name: string | null; product_type: string; status: string
  payment_ref: string; price: string | null; currency: string; payment_url: string
  tracking_code: string; cancel_reason: string; paid_at: string | null; created_at: string
  image_url?: string; notes?: string
}

const CUSTOM_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review", review: "In review", approved: "Approved - pay now",
  paid: "Paid", printing: "Printing", shipped: "Shipped", cancelled: "Cancelled",
}
type Order = { id: string; order_number: string; status: string; total: string; created_at: string; items_count?: number; items?: { id: number }[]; tracking_code: string; currency?: string }
type WishlistProduct = {
  id: string
  slug?: string
  category_slug?: string
  title: string
  artist_name: string
  base_price: string
  image_url: string
  status?: "active" | "paused" | "sold"
}
type WishlistItem = { id: number; product: WishlistProduct; added_at: string }
type Address = { id: number; label: string; line1: string; line2: string; city: string; state: string; zip_code: string; country: string; is_default: boolean }
type ReferralStats = { code: string; total_invites: number; converted_invites: number }
type CreatorSummary = {
  is_creator: boolean
  creator: {
    voucher_code: string | null
    available_balance: string
    lifetime_earned: string
  } | null
  redemptions?: unknown[]
}

const ACCOUNT_TABS = [
  { id: "overview",      label: "Overview",       Icon: User },
  { id: "inbox",         label: "Inbox",          Icon: MessageSquare },
  { id: "orders",        label: "Orders",         Icon: Package },
  { id: "custom",        label: "Custom Orders",  Icon: FileText },
  { id: "wishlist",      label: "Wishlist",       Icon: Heart },
  { id: "loyalty",       label: "Loyalty",        Icon: Award },
  { id: "settings",      label: "Settings",       Icon: Settings },
  { id: "addresses",     label: "Addresses",      Icon: MapPin },
  { id: "payments",      label: "Payments",       Icon: CreditCard },
  { id: "creator",       label: "Creator",        Icon: Megaphone },
]

const ORDER_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  delivered:  { label: "Delivered",   icon: <CheckCircle2 size={13} />, color: "text-dp-success" },
  shipped:    { label: "Shipped",     icon: <Truck size={13} />,        color: "text-dp-accent-gold" },
  processing: { label: "Processing",  icon: <Clock size={13} />,        color: "text-dp-text-secondary" },
  cancelled:  { label: "Cancelled",   icon: <XCircle size={13} />,      color: "text-dp-accent-cta" },
  refunded:   { label: "Refunded",    icon: <XCircle size={13} />,      color: "text-orange-400" },
}

function OverviewTab({ onOpenCreator }: { onOpenCreator?: () => void }) {
  const { profile } = useGamification()
  const { formatPrice } = useLocale()
  const lp = useLocalePrefix()
  const [orders, setOrders] = useState<Order[]>([])
  const [referral, setReferral] = useState<ReferralStats | null>(null)
  const [creatorSummary, setCreatorSummary] = useState<CreatorSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    authFetch<Order[] | PaginatedResponse<Order>>("/orders/").then((d) => { if (!cancelled) setOrders(parseList(d).slice(0, 3)) }).catch(() => {})
    authFetch<ReferralStats>("/referrals/me/").then((d) => { if (!cancelled) setReferral(d) }).catch(() => {})
    authFetch<CreatorSummary>("/creators/me/").then((d) => { if (!cancelled) setCreatorSummary(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const tier = profile?.tier
  const spendablePoints = profile?.spendable_points ?? 0
  const lifetimePoints = profile?.lifetime_points ?? 0
  const pendingPoints = profile?.pending_points ?? 0
  const progress = tier?.progress_percent ?? 0
  const saleBonus = parseFloat(tier?.sale_bonus_percent ?? tier?.discount_percent ?? "0")
  const nextSaleBonus = tier?.next_sale_bonus_percent ? parseFloat(tier.next_sale_bonus_percent) : null
  const saleBonusCta = saleBonus >= 10
    ? "You have +10% extra discount on products that are already on sale."
    : saleBonus >= 5
      ? `You have +5% extra on sale products. Reach ${tier?.next_label ?? "the next level"} to get +${nextSaleBonus ?? 10}% on sale products.`
      : "On higher levels, sale products get an extra +5% or +10% loyalty discount."

  return (
    <div className="flex flex-col gap-8">
      {creatorSummary?.is_creator && creatorSummary.creator && (
        <div className="border border-dp-accent-gold/50 bg-dp-accent-gold/5 rounded-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-gold mb-1 flex items-center gap-1.5">
            <Megaphone size={12} /> Creator voucher
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="font-mono text-2xl font-black text-dp-text-primary">{creatorSummary.creator.voucher_code || "Pending code"}</p>
              <p className="text-[12px] text-dp-text-secondary mt-1">
                Used by {creatorSummary.redemptions?.length ?? 0} customer{(creatorSummary.redemptions?.length ?? 0) === 1 ? "" : "s"} · Lifetime earned {creatorSummary.creator.lifetime_earned}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onOpenCreator} className="px-4 py-2 bg-dp-text-primary text-white text-[11px] font-black uppercase tracking-widest rounded-sm">Earnings</button>
              <button type="button" onClick={onOpenCreator} className="px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-black uppercase tracking-widest rounded-sm">Payout</button>
            </div>
          </div>
        </div>
      )}
      {!creatorSummary?.is_creator && <button
        type="button"
        onClick={onOpenCreator}
        className="w-full text-left border border-dp-accent-cta/40 bg-dp-accent-cta/5 hover:bg-dp-accent-cta/10 rounded-sm p-5 transition-colors"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta mb-1 flex items-center gap-1.5">
          <Megaphone size={12} /> Content creators
        </p>
        <p className="font-display text-2xl text-dp-text-primary">Get your own voucher</p>
        <p className="text-[13px] text-dp-text-secondary mt-1">
          Apply here — share your code, fans get a product discount, you earn GEL when orders are paid.
        </p>
        <span className="inline-flex mt-3 text-[11px] font-black uppercase tracking-widest text-dp-accent-cta">
          Open Creator tab →
        </span>
      </button>}

      <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-gold mb-0.5">Loyalty tier</p>
            <p className="font-display text-3xl text-dp-text-primary">{tier?.label ?? "Genin"}</p>
            <p className="text-[12px] text-dp-text-secondary mt-1">+{saleBonus.toFixed(0)}% extra on sale products</p>
            <p className="text-[11px] text-dp-accent-gold mt-1">{saleBonusCta}</p>
          </div>
          <div className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-dp-accent-gold">
            <Award size={20} className="text-dp-accent-gold" />
          </div>
        </div>
        <div className="w-full bg-dp-bg-elevated rounded-full h-2 overflow-hidden">
          <div className="h-full bg-dp-accent-gold rounded-full transition-all duration-700" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={spendablePoints} aria-valuemax={tier?.next_threshold ?? spendablePoints} aria-label="Loyalty tier progress" />
        </div>
        {tier?.next_label ? (
          <p className="text-[11px] text-dp-text-tertiary mt-2">{tier.points_to_next.toLocaleString()} current points until {tier.next_label}</p>
        ) : (
          <p className="text-[11px] text-dp-accent-gold mt-2 font-bold">Top loyalty tier reached.</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { icon: ShoppingBag, label: "Total Orders",  value: orders.length },
          { icon: Award,       label: "Tier",          value: tier?.label ?? "Genin" },
          { icon: Star,        label: "Total Earned", value: lifetimePoints.toLocaleString() },
          { icon: Clock,       label: "Pending Points", value: pendingPoints.toLocaleString() },
          { icon: Heart,       label: "Current Points", value: spendablePoints.toLocaleString() },
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
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">How points work</h3>
          <p className="text-[12px] text-dp-text-secondary">Every successful checkout creates pending points at 0.5 points per 1 currency unit. Points become spendable when the order is marked as shipped.</p>
        </div>
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Discount rule</h3>
          <p className="text-[12px] text-dp-text-secondary">Tier bonuses apply only to sale products. Vouchers apply only to non-sale products, so they never stack on the same item.</p>
          <Link href={`${lp}/account/awards`} className="inline-flex mt-3 text-[11px] font-black uppercase tracking-widest text-dp-accent-cta hover:underline">Open Points Market</Link>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-dp-text-primary">Recent Orders</h2>
          <button className="text-[11px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors flex items-center gap-1">View all <ChevronRight size={11} /></button>
        </div>
        {orders.length === 0 ? (
          <p className="text-[13px] text-dp-text-tertiary py-4">No orders yet. <Link href={`${lp}/catalog`} className="text-dp-accent-cta hover:underline">Shop now</Link></p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => {
              const cfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.processing
              return (
                <div key={order.id} className="bg-dp-bg-surface border border-dp-border rounded-sm p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[13px] font-bold text-dp-text-primary">{order.order_number}</p>
                    <p className="text-[11px] text-dp-text-tertiary">{order.items_count} item{order.items_count !== 1 ? "s" : ""} · {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${cfg.color}`}>{cfg.icon} {cfg.label}</div>
                  <span className="font-bold text-dp-text-primary text-[14px]">{formatAmount(parseFloat(order.total), (order.currency ?? "USD") as Currency)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {referral && (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <h2 className="font-display text-2xl text-dp-text-primary mb-3">Referral Program</h2>
          <p className="text-[12px] text-dp-text-secondary mb-3">
            Share your link. When a friend buys for the first time, both of you can receive approved account rewards.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <code className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/?ref=${referral.code}` : `/?ref=${referral.code}`}
            </code>
          </div>
          <p className="inline-flex items-center gap-2 text-[13px] font-black text-dp-text-primary bg-dp-accent-gold/10 border border-dp-accent-gold/30 px-3 py-2 rounded-sm mt-3">
            Invites: {referral.total_invites}
          </p>
        </div>
      )}
    </div>
  )
}

function OrdersTab() {
  const lp = useLocalePrefix()
  const { formatPrice } = useLocale()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authFetch<Order[] | PaginatedResponse<Order>>("/orders/")
      .then((d) => { if (!cancelled) setOrders(parseList(d)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
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
            href={`${lp}/catalog`}
            className="px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
          >
            Shop Now
          </Link>
        </div>
      ) : orders.map((order) => {
        const cfg = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.processing
        return (
          <div key={order.id} className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[13px] font-bold text-dp-text-primary">{order.order_number}</p>
                <p className="text-[11px] text-dp-text-tertiary mt-0.5">{new Date(order.created_at).toLocaleDateString()} · {(order.items_count ?? order.items?.length ?? 0)} item{(order.items_count ?? order.items?.length ?? 0) !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${cfg.color}`}>{cfg.icon} {cfg.label}</div>
                <span className="font-display text-xl text-dp-text-primary">
                  {formatAmount(parseFloat(order.total), (order.currency ?? "USD") as Currency)}
                </span>
              </div>
            </div>
            {order.tracking_code && (
              <p className="text-[11px] text-dp-text-tertiary">Tracking: <span className="font-mono text-dp-text-secondary">{order.tracking_code}</span></p>
            )}
            <div className="flex gap-2 mt-3">
              <Link href={`${lp}/account/orders/${order.id}`} className="px-4 py-1.5 border border-dp-border rounded-sm text-[11px] font-bold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">View Details</Link>
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

function CustomOrdersTab() {
  const lp = useLocalePrefix()
  const [orders, setOrders] = useState<CustomOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authFetch<CustomOrder[] | PaginatedResponse<CustomOrder>>("/orders/custom/mine/")
      .then((d) => { if (!cancelled) setOrders(parseList(d)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-3xl text-dp-text-primary">Custom Orders</h2>
      {loading ? (
        <div className="animate-pulse space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <FileText size={40} className="text-dp-text-tertiary" />
          <p className="text-dp-text-secondary text-[14px]">No custom orders yet.</p>
          <Link href={`${lp}/custom`} className="px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
            Start Custom Order
          </Link>
        </div>
      ) : orders.map((order) => (
        <div key={order.id} className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3 min-w-0">
              {order.image_url && (
                <img src={order.image_url} alt="" className="w-14 h-14 rounded-sm object-cover border border-dp-border shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-dp-text-primary">{order.product_type || "Custom order"}</p>
                <p className="text-[11px] text-dp-text-tertiary mt-0.5">
                  {order.vendor_name ?? "Vendor"} · {order.payment_ref}
                </p>
                <p className="text-[11px] text-dp-text-tertiary">
                  Submitted {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm border ${
              order.status === "cancelled" ? "text-red-400 border-red-400/30 bg-red-400/10"
              : order.status === "approved" ? "text-dp-accent-cta border-dp-accent-cta/30 bg-dp-accent-cta/10"
              : order.status === "paid" || order.status === "shipped" ? "text-dp-success border-dp-success/30 bg-dp-success/10"
              : "text-dp-text-secondary border-dp-border bg-dp-bg-elevated"
            }`}>
              {CUSTOM_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          {order.notes && (
            <p className="text-[12px] text-dp-text-secondary">{order.notes}</p>
          )}
          {order.price && (
            <p className="text-[14px] font-bold text-dp-text-primary">
              {formatAmount(parseFloat(order.price), (order.currency ?? "USD") as Currency)}
            </p>
          )}
          {order.status === "approved" && order.payment_url && (
            <a href={order.payment_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors">
              <ExternalLink size={12} /> Pay Now
            </a>
          )}
          {order.paid_at && <p className="text-[12px] text-dp-success">Paid on {new Date(order.paid_at).toLocaleDateString()}</p>}
          {order.tracking_code && (
            <p className="text-[11px] text-dp-text-tertiary">Tracking: <span className="font-mono text-dp-text-secondary">{order.tracking_code}</span></p>
          )}
          {order.status === "cancelled" && order.cancel_reason && (
            <p className="text-[12px] text-red-400">Reason: {order.cancel_reason}</p>
          )}
        </div>
      ))}
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
          {items.map((item) => {
            const p = item.product
            const available = (p.status ?? "active") === "active"
            const card = (
              <>
                <div className="aspect-poster relative bg-dp-bg-elevated">
                  {p.image_url && <Image src={p.image_url} alt={p.title} fill className={`object-cover transition-transform duration-500 ${available ? "group-hover:scale-105" : "grayscale opacity-60"}`} sizes="(max-width: 640px) 50vw, 25vw" />}
                  {!available && <div className="absolute inset-x-2 bottom-2 bg-dp-bg-surface/95 border border-dp-border px-2 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-dp-accent-cta">Not available now</div>}
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-dp-text-tertiary truncate">{p.artist_name}</p>
                  <p className="text-[13px] font-semibold text-dp-text-primary truncate">{p.title}</p>
                  <p className="text-[14px] font-bold text-dp-text-primary mt-1">{available ? formatPrice(parseFloat(p.base_price)) : "Unavailable"}</p>
                </div>
              </>
            )
            return (
            available ? (
              <Link key={item.id} href={productHref({ id: p.id, slug: p.slug, categorySlug: p.category_slug })} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover">{card}</Link>
            ) : (
              <div key={item.id} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden opacity-90" aria-disabled>{card}</div>
            )
            )
          })}
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

function LoyaltyTab() {
  const { profile } = useGamification()
  const lp = useLocalePrefix()
  const tier = profile?.tier
  const lifetimePoints = profile?.lifetime_points ?? 0
  const spendablePoints = profile?.spendable_points ?? 0
  const pendingPoints = profile?.pending_points ?? 0
  const progress = tier?.progress_percent ?? 0
  const saleBonus = parseFloat(tier?.sale_bonus_percent ?? tier?.discount_percent ?? "0")
  const nextSaleBonus = tier?.next_sale_bonus_percent ? parseFloat(tier.next_sale_bonus_percent) : null
  const saleBonusCta = saleBonus >= 10
    ? "You have +10% extra discount on products that are already on sale."
    : saleBonus >= 5
      ? `You have +5% extra on sale products. Reach ${tier?.next_label ?? "the next level"} to get +${nextSaleBonus ?? 10}% on sale products.`
      : "If you reach the next levels, sale products can get an extra +5% or +10% loyalty discount."

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-3xl text-dp-text-primary mb-2">Loyalty &amp; Points</h2>
          <p className="text-[13px] text-dp-text-tertiary">Your tier is based on current spendable points. Pending order points become spendable when the order ships.</p>
      </div>
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-gold">Current tier</p>
            <p className="font-display text-4xl text-dp-text-primary mt-1">{tier?.label ?? "Genin"}</p>
            <p className="text-[13px] text-dp-text-secondary mt-1">+{saleBonus.toFixed(0)}% extra on sale products</p>
            <p className="text-[12px] text-dp-accent-gold mt-2">{saleBonusCta}</p>
          </div>
          <Award size={32} className="text-dp-accent-gold" />
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between text-[11px] text-dp-text-tertiary mb-2">
            <span>{spendablePoints.toLocaleString()} current points</span>
            <span>{tier?.next_label ? `${tier.points_to_next.toLocaleString()} to ${tier.next_label}` : "Top tier reached"}</span>
          </div>
          <div className="h-2 rounded-full bg-dp-bg-elevated overflow-hidden">
            <div className="h-full bg-dp-accent-gold" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Spendable points</p>
          <p className="font-display text-4xl text-dp-text-primary mt-2">{spendablePoints.toLocaleString()}</p>
          <p className="text-[12px] text-dp-text-secondary mt-2">Available points can be spent in the market. Pending points unlock when your order ships.</p>
        </div>
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Pending points</p>
          <p className="font-display text-4xl text-dp-text-primary mt-2">{pendingPoints.toLocaleString()}</p>
          <p className="text-[12px] text-dp-text-secondary mt-2">Recent order points waiting for the order to be marked as shipped.</p>
        </div>
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Exclusive discount rule</p>
          <p className="text-[13px] text-dp-text-secondary mt-2">Sale products get your tier bonus. Vouchers and creator codes work only on non-sale products.</p>
          <Link href={`${lp}/account/awards`} className="inline-flex mt-4 px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-black uppercase tracking-widest rounded-sm">Open Points Market</Link>
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
        setAddresses((prev) => prev.map((a) => {
          if (a.id === editing.id) return updated
          if (updated.is_default) return { ...a, is_default: false }
          return a
        }))
      } else {
        const created = await authFetch<Address>("/auth/addresses/", { method: "POST", body: JSON.stringify(form) })
        setAddresses((prev) => {
          const cleared = created.is_default ? prev.map((a) => ({ ...a, is_default: false })) : prev
          return [...cleared, created]
        })
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

  async function makeDefault(id: number) {
    const updated = await authFetch<Address>(`/auth/addresses/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_default: true }),
    }).catch(() => null)
    if (!updated) return
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === updated.id })))
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
              <select required value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputCls}>
                {CHECKOUT_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
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
              <p className="text-[13px] text-dp-text-secondary">{countryName(addr.country)}</p>
              <div className="flex gap-2 mt-4 flex-wrap">
                {!addr.is_default && (
                  <button onClick={() => makeDefault(addr.id)} className="flex items-center gap-1 px-3 py-1.5 border border-dp-accent-gold/50 rounded-sm text-[11px] font-bold text-dp-accent-gold hover:bg-dp-accent-gold/10 transition-colors">
                    <Check size={11} /> Make Default
                  </button>
                )}
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const token = getAccessToken()
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const res = await fetch(`${base}/auth/me/avatar/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(data.detail ?? "Avatar upload failed.")
      }
      await refreshUser()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Avatar upload failed.")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const inputCls = "w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
  const labelCls = "block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2"

  return (
    <div className="flex flex-col gap-10 w-full min-w-0 max-w-lg overflow-x-hidden">
      <h2 className="font-display text-3xl text-dp-text-primary">Account Settings</h2>

      {/* Personal Information */}
      <section className="w-full min-w-0">
        <h3 className="font-display text-xl text-dp-text-primary mb-5">Personal Information</h3>
        <form className="flex flex-col gap-5" onSubmit={handleSaveInfo}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label className={labelCls}>Avatar image</label>
            <div className="flex items-center gap-4">
              {user?.avatar ? (
                <Image src={user.avatar} alt={user.name || user.email} width={56} height={56} className="rounded-full border border-dp-border object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-dp-bg-elevated border border-dp-border flex items-center justify-center text-dp-text-tertiary">
                  <User size={20} />
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-dp-border rounded-sm text-[12px] font-semibold text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
                <Plus size={13} /> {uploadingAvatar ? "Uploading..." : "Upload image"}
                <input type="file" accept="image/*" className="sr-only" disabled={uploadingAvatar} onChange={(e) => e.target.files?.[0] && void handleAvatarUpload(e.target.files[0])} />
              </label>
            </div>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={savingInfo} className={`w-full sm:w-auto sm:self-start px-8 py-3 rounded-sm text-[12px] font-black uppercase tracking-widest transition-colors disabled:opacity-60 ${savedInfo ? "bg-dp-success text-white" : "bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white"}`}>
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
          <button type="submit" disabled={savingPw} className="w-full sm:w-auto sm:self-start px-8 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
            {savingPw ? "Updating…" : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  )
}

type PaymentMethod = { id: number; brand: string; last4: string; exp_month: number; exp_year: number; is_default: boolean }

const EMPTY_CARD = { brand: "visa", last4: "", exp_month: "", exp_year: "", is_default: false }

function PaymentsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_CARD)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    authFetch<PaymentMethod[]>("/auth/payment-methods/")
      .then((d) => { if (!cancelled) setMethods(Array.isArray(d) ? d : (d as { results: PaymentMethod[] }).results ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.last4.match(/^\d{4}$/) || !form.exp_month || !form.exp_year) return
    setSaving(true)
    try {
      const created = await authFetch<PaymentMethod>("/auth/payment-methods/", {
        method: "POST",
        body: JSON.stringify({
          brand: form.brand,
          last4: form.last4,
          exp_month: parseInt(form.exp_month, 10),
          exp_year: parseInt(form.exp_year, 10),
          is_default: form.is_default || methods.length === 0,
        }),
      })
      setMethods((prev) => {
        const cleared = created.is_default ? prev.map((m) => ({ ...m, is_default: false })) : prev
        return [...cleared, created]
      })
      setForm(EMPTY_CARD)
      setAdding(false)
    } catch {
      // keep form open
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await authFetch(`/auth/payment-methods/${id}/`, { method: "DELETE" }).catch(() => {})
    setMethods((prev) => prev.filter((m) => m.id !== id))
  }

  async function makeDefault(id: number) {
    const updated = await authFetch<PaymentMethod>(`/auth/payment-methods/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_default: true }),
    }).catch(() => null)
    if (!updated) return
    setMethods((prev) => prev.map((m) => ({ ...m, is_default: m.id === updated.id })))
  }

  const inputCls = "w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover"
  const labelCls = "block text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary mb-1.5"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl text-dp-text-primary">Payment Methods</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] font-black uppercase tracking-widest rounded-sm transition-colors">
            <Plus size={13} /> Add Card
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-dp-bg-surface border border-dp-border rounded-sm p-6 grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Brand</label>
            <select value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className={inputCls}>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">Amex</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Last 4 digits *</label>
            <input required maxLength={4} value={form.last4} onChange={(e) => setForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Exp. month *</label>
            <input required type="number" min={1} max={12} value={form.exp_month} onChange={(e) => setForm((f) => ({ ...f, exp_month: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Exp. year *</label>
            <input required type="number" min={2024} max={2099} value={form.exp_year} onChange={(e) => setForm((f) => ({ ...f, exp_year: e.target.value }))} className={inputCls} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="card_default" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
            <label htmlFor="card_default" className="text-[13px] text-dp-text-secondary">Set as default payment method</label>
          </div>
          <div className="col-span-2 flex gap-3">
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-dp-accent-cta text-white text-[12px] font-black uppercase tracking-widest rounded-sm">{saving ? "Saving…" : "Save Card"}</button>
            <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_CARD) }} className="px-6 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest text-dp-text-secondary rounded-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : methods.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-4 py-16 text-dp-text-tertiary">
          <CreditCard size={40} className="opacity-30" />
          <p className="text-[13px]">No saved payment methods yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {methods.map((m) => (
            <div key={m.id} className={`relative bg-dp-bg-surface border rounded-sm p-5 ${m.is_default ? "border-dp-accent-gold" : "border-dp-border"}`}>
              {m.is_default && <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest bg-dp-accent-gold/20 text-dp-accent-gold px-2 py-0.5 rounded-full">Default</span>}
              <div className="flex items-center gap-3 mb-2">
                <CreditCard size={18} className="text-dp-text-tertiary" />
                <p className="text-[14px] font-bold text-dp-text-primary uppercase">{m.brand}</p>
              </div>
              <p className="text-[13px] text-dp-text-secondary">•••• •••• •••• {m.last4}</p>
              <p className="text-[12px] text-dp-text-tertiary mt-1">Expires {String(m.exp_month).padStart(2, "0")}/{m.exp_year}</p>
              <div className="flex gap-2 mt-4 flex-wrap">
                {!m.is_default && (
                  <button onClick={() => makeDefault(m.id)} className="flex items-center gap-1 px-3 py-1.5 border border-dp-accent-gold/50 rounded-sm text-[11px] font-bold text-dp-accent-gold hover:bg-dp-accent-gold/10 transition-colors">
                    <Check size={11} /> Make Default
                  </button>
                )}
                <button onClick={() => handleDelete(m.id)} className="flex items-center gap-1 px-3 py-1.5 border border-dp-border rounded-sm text-[11px] font-bold text-dp-text-secondary hover:text-dp-accent-cta hover:border-dp-accent-cta/50 transition-colors">
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
  const searchParams = useSearchParams()
  const lp = useLocalePrefix()
  const inboxUnread = useInboxUnreadCount()

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ACCOUNT_TABS.some((t) => t.id === tab)) setActiveTab(tab)
  }, [searchParams])

  function openTab(id: string) {
    setActiveTab(id)
    router.replace(`${lp}/account?tab=${id}`, { scroll: false })
  }

  async function handleLogout() {
    await logout()
    router.push(`${lp}/login`)
  }

  const tabContent: Record<string, React.ReactNode> = {
    overview:      <OverviewTab onOpenCreator={() => openTab("creator")} />,
    inbox:         <InboxTab />,
    orders:        <OrdersTab />,
    custom:        <CustomOrdersTab />,
    wishlist:      <WishlistTab />,
    loyalty:       <LoyaltyTab />,
    creator:       <CreatorPanel />,
    settings:      <SettingsTab />,
    addresses:     <AddressesTab />,
    payments:      <PaymentsTab />,
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
                <p className="text-[12px] text-dp-text-tertiary mt-0.5">{profile?.tier.label ?? "Genin"} · {(profile?.spendable_points ?? 0).toLocaleString()} current points</p>
              </div>
              <Link
                href={inboxUnread > 0 ? `${lp}/inbox` : `${lp}/account/notifications`}
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
            <button key={id} onClick={() => openTab(id)}
              className={`shrink-0 px-3 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap flex items-center gap-1.5 ${id === "loyalty" ? "border border-dp-accent-gold/60 bg-gradient-to-r from-dp-accent-gold/20 to-dp-accent-cta/10 text-dp-text-primary shadow-[0_0_0_1px_rgba(184,110,0,0.08)]" : activeTab === id ? "bg-dp-accent-cta text-white" : "bg-dp-bg-surface border border-dp-border text-dp-text-secondary hover:text-dp-text-primary"} ${activeTab === id && id === "loyalty" ? "ring-2 ring-dp-accent-gold/30" : ""}`}>
              {label}
              {id === "inbox" && <UnreadBadge count={inboxUnread} />}
            </button>
          ))}
        </div>

        <aside className="hidden md:flex flex-col w-52 shrink-0 gap-1" aria-label="Account navigation">
          {ACCOUNT_TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => openTab(id)}
              className={`flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-sm text-[13px] font-medium text-left transition-colors w-full ${id === "creator" ? "mt-5 border border-dp-accent-gold/40 bg-dp-accent-gold/5 text-dp-text-primary hover:border-dp-accent-gold/70" : id === "loyalty" ? "border border-dp-accent-gold/60 bg-gradient-to-r from-dp-accent-gold/15 via-dp-bg-surface to-dp-accent-cta/10 text-dp-text-primary shadow-sm hover:border-dp-accent-gold" : activeTab === id ? "bg-dp-bg-elevated text-dp-text-primary" : "text-dp-text-secondary hover:bg-dp-bg-elevated hover:text-dp-text-primary"} ${activeTab === id && id === "loyalty" ? "ring-2 ring-dp-accent-gold/25" : ""}`}
              aria-current={activeTab === id ? "page" : undefined}>
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon size={14} className={id === "creator" || id === "loyalty" ? "text-dp-accent-gold" : activeTab === id ? "text-dp-accent-cta" : "text-dp-text-tertiary"} />
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
