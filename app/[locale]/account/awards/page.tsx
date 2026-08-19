"use client"

import React, { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Award, CheckCircle2, ChevronLeft, ChevronRight, Copy, Gift, Lock, ShoppingBag, Sparkles, X } from "lucide-react"
import SiteShell from "@/components/layout/SiteShell"
import { useLoyalty } from "@/contexts/gamification-context"
import { authFetch, getApiErrorMessage, parseList, type PaginatedResponse } from "@/lib/api"
import { CHECKOUT_COUNTRIES } from "@/lib/countries"

type PointTransaction = {
  id: number
  transaction_type: string
  status: string
  points: number
  description: string
  available_at: string | null
  metadata?: Record<string, unknown>
  created_at: string
}

type PointsMarketItem = {
  id: number
  name: string
  description: string
  main_image_url: string
  image_urls: string[]
  point_cost: number
  stock_quantity: number
  item_type: "physical" | "digital"
  voucher_discount_type: "percent" | "fixed"
  voucher_discount_value: string
  voucher_min_order_value: string
  is_active: boolean
  is_locked: boolean
  can_purchase: boolean
}

type Address = {
  id: number
  label: string
  line1: string
  line2: string
  city: string
  state: string
  zip_code: string
  country: string
  is_default: boolean
}

type ShippingOption = {
  slug: string
  label: string
  price: string
  currency: string
  est_days_min: number
  est_days_max: number
  is_pickup: boolean
  requires_payment: boolean
}

const EMPTY_ADDRESS = {
  label: "Points reward",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip_code: "",
  country: "GE",
  phone: "",
  save_address: true,
}

export default function AwardsPage(): React.ReactElement {
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname.split("/").filter(Boolean)[0] || "en"
  const { profile, loading: profileLoading, refresh } = useLoyalty()
  const [items, setItems] = useState<PointsMarketItem[]>([])
  const [transactions, setTransactions] = useState<PointTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [buyingId, setBuyingId] = useState<number | null>(null)
  const [marketSlides, setMarketSlides] = useState<Record<number, number>>({})
  const [confirmItem, setConfirmItem] = useState<PointsMarketItem | null>(null)
  const [voucherResult, setVoucherResult] = useState<{ code: string; label: string } | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressMode, setAddressMode] = useState<"saved" | "new">("saved")
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [shippingSlug, setShippingSlug] = useState("")
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false)
  const [shippingLoading, setShippingLoading] = useState(false)

  function loadData() {
    setLoading(true)
    setError("")
    Promise.all([
      authFetch<PointsMarketItem[] | PaginatedResponse<PointsMarketItem>>("/gamification/market/"),
      authFetch<PointTransaction[] | PaginatedResponse<PointTransaction>>("/gamification/transactions/"),
    ])
      .then(([marketData, transactionData]) => {
        setItems(parseList(marketData))
        setTransactions(parseList(transactionData).slice(0, 8))
      })
      .catch((err) => setError(getApiErrorMessage(err, "Could not load loyalty rewards.")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (confirmItem?.item_type !== "physical") return
    setFulfillmentLoading(true)
    authFetch<Address[] | PaginatedResponse<Address>>("/auth/addresses/")
      .then((data) => {
        const list = parseList(data)
        setAddresses(list)
        const defaultAddress = list.find((addr) => addr.is_default) || list[0]
        if (defaultAddress) {
          setAddressMode("saved")
          setSelectedAddressId(defaultAddress.id)
        } else {
          setAddressMode("new")
          setSelectedAddressId(null)
        }
      })
      .catch(() => {
        setAddressMode("new")
        setSelectedAddressId(null)
      })
      .finally(() => setFulfillmentLoading(false))
  }, [confirmItem?.id, confirmItem?.item_type])

  useEffect(() => {
    if (confirmItem?.item_type !== "physical") return
    const country = activeShippingCountry()
    setShippingLoading(true)
    setShippingSlug("")
    authFetch<ShippingOption[] | PaginatedResponse<ShippingOption>>(`/gamification/market/shipping-options/?country=${encodeURIComponent(country)}&item_id=${confirmItem.id}`)
      .then((data) => {
        const list = parseList(data)
        setShippingOptions(list)
        setShippingSlug((current) => current && list.some((opt) => opt.slug === current) ? current : (list[0]?.slug || ""))
      })
      .catch(() => setShippingOptions([]))
      .finally(() => setShippingLoading(false))
  }, [confirmItem?.id, confirmItem?.item_type, selectedAddressId, addressMode, addressForm.country, addresses])

  function voucherLabel(item: PointsMarketItem): string {
    const value = Number(item.voucher_discount_value || 0)
    return item.voucher_discount_type === "percent" ? `${value.toFixed(0)}% checkout promo code` : `$${value.toFixed(2)} checkout promo code`
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setMessage(`Copied ${text}.`)
  }

  function selectedAddress(): Address | undefined {
    if (!Array.isArray(addresses)) return undefined
    return addresses.find((addr) => addr.id === selectedAddressId)
  }

  function activeShippingCountry(): string {
    if (addressMode === "saved") return selectedAddress()?.country || "GE"
    return addressForm.country || "GE"
  }

  function newAddressIsComplete(): boolean {
    return Boolean(addressForm.line1 && addressForm.city && addressForm.state && addressForm.zip_code && addressForm.country)
  }

  async function purchase(item: PointsMarketItem) {
    setBuyingId(item.id)
    setError("")
    setMessage("")
    try {
      const idempotencyKey = crypto.randomUUID()
      const result = item.item_type === "physical"
        ? await authFetch<{
          payment_required?: boolean
          detail?: string
          shipping_payment_session?: { token: string }
          redemption?: { id: number; shipping_label: string }
          voucher?: null
        }>("/gamification/market/redeem-physical/", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({
            item_id: item.id,
            shipping_slug: shippingSlug,
            country: activeShippingCountry(),
            ...(addressMode === "saved" && selectedAddressId ? { address_id: selectedAddressId } : { address: addressForm }),
          }),
        })
        : await authFetch<{ voucher?: { code: string; discount_type: string; discount_value: string } | null }>("/gamification/market/purchase/", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ item_id: item.id }),
        })
      const redemptionResult = result as { payment_required?: boolean; detail?: string }
      if (redemptionResult.payment_required) {
        const sessionToken = (result as { shipping_payment_session?: { token?: string } }).shipping_payment_session?.token
        if (sessionToken) {
          router.push(`/${locale}/account/awards/shipping-payment?session=${encodeURIComponent(sessionToken)}`)
        } else {
          setError(redemptionResult.detail || "Shipping payment is required before this reward can be redeemed. Points and stock were not changed.")
        }
        return
      }
      if (result.voucher?.code) {
        const value = Number(result.voucher.discount_value || 0)
        setVoucherResult({
          code: result.voucher.code,
          label: result.voucher.discount_type === "percent" ? `${value.toFixed(0)}% checkout voucher` : `$${value.toFixed(2)} checkout voucher`,
        })
      } else {
        setMessage(`${item.name} redemption was created. Admin will review and fulfill it.`)
      }
      await refresh()
      loadData()
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not purchase this reward."))
    } finally {
      setBuyingId(null)
      setConfirmItem(null)
    }
  }

  const tier = profile?.tier
  const spendable = profile?.spendable_points ?? 0
  const lifetime = profile?.lifetime_points ?? 0
  const pending = profile?.pending_points ?? 0
  const saleBonus = parseFloat(tier?.sale_bonus_percent ?? tier?.discount_percent ?? "0")
  const nextSaleBonus = tier?.next_sale_bonus_percent ? parseFloat(tier.next_sale_bonus_percent) : null
  const saleBonusCta = saleBonus >= 10
    ? "You have +10% extra discount on products that are already on sale."
    : saleBonus >= 5
      ? `You have +5% extra on sale products. Reach ${tier?.next_label ?? "the next level"} to get +${nextSaleBonus ?? 10}% on sale products.`
      : "Level up to unlock +5% and then +10% extra discount on sale products."

  function marketImages(item: PointsMarketItem): string[] {
    const urls = [item.main_image_url, ...(item.image_urls || [])].filter(Boolean)
    return Array.from(new Set(urls))
  }

  function shiftMarketSlide(itemId: number, count: number, direction: -1 | 1) {
    setMarketSlides((prev) => {
      const current = prev[itemId] || 0
      return { ...prev, [itemId]: (current + direction + count) % count }
    })
  }

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <div className="mb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-gold mb-2">Secure loyalty ledger</p>
          <h1 className="font-display text-4xl text-dp-text-primary">Loyalty & Points Market</h1>
          <p className="text-[14px] text-dp-text-secondary mt-1">
            Earn pending points after checkout, unlock them when your order ships, and spend available points on approved market rewards.
          </p>
        </div>

        {error && <div className="mb-4 px-4 py-3 border border-dp-accent-cta/30 bg-dp-accent-cta/10 text-dp-accent-cta text-[13px] rounded-sm">{error}</div>}
        {message && <div className="mb-4 px-4 py-3 border border-dp-success/30 bg-dp-success/10 text-dp-success text-[13px] rounded-sm">{message}</div>}

        {profileLoading ? (
          <div className="animate-pulse h-36 bg-dp-bg-elevated rounded-sm mb-8" />
        ) : (
          <section className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="md:col-span-2 bg-dp-bg-surface border border-dp-border rounded-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Current tier</p>
                  <p className="font-display text-4xl text-dp-text-primary mt-1">{tier?.label ?? "Genin"}</p>
                  <p className="text-[13px] text-dp-text-secondary mt-1">+{saleBonus.toFixed(0)}% extra on sale products</p>
                  <p className="text-[12px] text-dp-accent-gold mt-2">{saleBonusCta}</p>
                </div>
                <Award className="text-dp-accent-gold" size={34} />
              </div>
              <div className="mt-6">
                <div className="flex items-center justify-between text-[11px] text-dp-text-tertiary mb-2">
                  <span>{spendable.toLocaleString()} current points</span>
                  <span>{tier?.next_label ? `${tier.points_to_next.toLocaleString()} to ${tier.next_label}` : "Top tier reached"}</span>
                </div>
                <div className="h-2 rounded-full bg-dp-bg-elevated overflow-hidden">
                  <div className="h-full bg-dp-accent-gold transition-all" style={{ width: `${tier?.progress_percent ?? 0}%` }} />
                </div>
              </div>
            </div>
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6 flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Spendable balance</p>
                <p className="font-display text-5xl text-dp-text-primary mt-2">{spendable.toLocaleString()}</p>
              </div>
              <p className="text-[12px] text-dp-text-secondary mt-4">
                {pending.toLocaleString()} pending points waiting for shipment · {lifetime.toLocaleString()} total points earned. Your level uses current spendable points, so it can go down after refunds or reward purchases.
              </p>
            </div>
          </section>
        )}

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Gift size={18} className="text-dp-accent-cta" />
            <h2 className="font-display text-2xl text-dp-text-primary">Points Market</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,260px))] items-start justify-start gap-3 animate-pulse">{[1, 2, 3, 4].map((i) => <div key={i} className="h-36 bg-dp-bg-elevated rounded-sm" />)}</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,260px))] items-start justify-start gap-3">
              {items.map((item) => {
                const disabled = item.is_locked || item.stock_quantity <= 0 || spendable < item.point_cost
                return (
                  <article key={item.id} className={`self-start w-full border rounded-sm p-3.5 bg-dp-bg-surface transition-opacity ${disabled ? "opacity-55" : "hover:border-dp-accent-gold/60"} ${disabled ? "border-dp-border" : "border-dp-accent-gold/30"}`}>
                    {marketImages(item).length > 0 && (
                      <div className="relative mb-3 h-32 sm:h-36 overflow-hidden rounded-sm border border-dp-border bg-dp-bg-elevated">
                        <img
                          src={marketImages(item)[marketSlides[item.id] || 0] || marketImages(item)[0]}
                          alt={item.name}
                          className="h-full w-full object-contain p-1"
                        />
                        {marketImages(item).length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => shiftMarketSlide(item.id, marketImages(item).length, -1)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center"
                              aria-label="Previous reward image"
                            >
                              <ChevronLeft size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => shiftMarketSlide(item.id, marketImages(item).length, 1)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center"
                              aria-label="Next reward image"
                            >
                              <ChevronRight size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-dp-text-tertiary">{item.item_type === "digital" ? "Digital voucher" : "Physical product"}</p>
                        <h3 className="font-display text-lg leading-tight text-dp-text-primary mt-1">{item.name}</h3>
                        {item.item_type === "digital" && (
                          <p className="text-[11px] text-dp-accent-gold mt-1">{voucherLabel(item)}</p>
                        )}
                      </div>
                      {disabled ? <Lock size={17} className="text-dp-text-tertiary" /> : <Sparkles size={17} className="text-dp-accent-gold" />}
                    </div>
                    <p className="text-[11px] leading-relaxed text-dp-text-secondary mt-2 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between gap-3 mt-4">
                      <div>
                        <p className="font-display text-xl text-dp-text-primary">{item.point_cost.toLocaleString()} pts</p>
                        <p className="text-[10px] text-dp-text-tertiary">{item.stock_quantity > 0 ? `${item.stock_quantity} in stock` : "Sold out"}</p>
                      </div>
                      <button
                        type="button"
                        disabled={disabled || buyingId === item.id}
                        onClick={() => setConfirmItem(item)}
                        className="shrink-0 px-3 py-1.5 bg-dp-accent-cta text-white text-[10px] font-black uppercase tracking-widest rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {buyingId === item.id ? "Buying..." : disabled ? "Unavailable" : "Buy"}
                      </button>
                    </div>
                  </article>
                )
              })}
              {items.length === 0 && <p className="text-[13px] text-dp-text-tertiary col-span-full py-8">No points market items are available yet.</p>}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag size={18} className="text-dp-text-tertiary" />
            <h2 className="font-display text-2xl text-dp-text-primary">Recent Ledger Activity</h2>
          </div>
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
            {transactions.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 border-b border-dp-border last:border-b-0">
                <div>
                  <p className="text-[13px] font-semibold text-dp-text-primary">{entry.description || entry.transaction_type.replaceAll("_", " ")}</p>
                  <p className="text-[11px] text-dp-text-tertiary">
                    {entry.status} · {entry.status === "pending" ? "Unlocks when order ships" : new Date(entry.created_at).toLocaleDateString()}
                  </p>
                  {typeof entry.metadata?.voucher_code === "string" && (
                    <button
                      type="button"
                      onClick={() => copyText(String(entry.metadata?.voucher_code))}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-dp-accent-gold/40 px-2 py-1 font-mono text-[11px] font-black text-dp-accent-gold"
                    >
                      {String(entry.metadata.voucher_code)} <Copy size={11} />
                    </button>
                  )}
                </div>
                <span className={`text-[13px] font-black ${entry.points >= 0 ? "text-dp-success" : "text-dp-accent-cta"}`}>
                  {entry.points >= 0 ? "+" : ""}{entry.points.toLocaleString()} pts
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-dp-text-tertiary">
                No point activity yet.
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-dp-text-tertiary flex items-center gap-1.5"><CheckCircle2 size={12} /> Points are controlled by an append-only ledger for audit safety.</p>
        </section>
        {confirmItem && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-sm border border-dp-border bg-dp-bg-surface p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-dp-accent-gold">Confirm purchase</p>
                  <h3 className="font-display text-2xl text-dp-text-primary mt-1">{confirmItem.name}</h3>
                </div>
                <button type="button" onClick={() => setConfirmItem(null)} className="text-dp-text-tertiary hover:text-dp-text-primary">
                  <X size={18} />
                </button>
              </div>
              <p className="mt-4 text-[13px] text-dp-text-secondary">
                Do you really want to spend <strong className="text-dp-text-primary">{confirmItem.point_cost.toLocaleString()} points</strong> on this reward?
              </p>
              {confirmItem.item_type === "digital" && (
                <p className="mt-2 rounded-sm border border-dp-accent-gold/30 bg-dp-accent-gold/10 px-3 py-2 text-[12px] text-dp-accent-gold">
                  You will receive an autogenerated one-use {voucherLabel(confirmItem)} for checkout.
                </p>
              )}
              {confirmItem.item_type === "physical" && (
                <div className="mt-4 space-y-4">
                  <p className="rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[12px] text-dp-text-secondary">
                    Choose fulfillment first. Points and stock change only after a free/self-pickup redemption is confirmed, or after paid shipping is successfully paid.
                  </p>
                  {fulfillmentLoading ? (
                    <div className="h-20 animate-pulse rounded-sm bg-dp-bg-elevated" />
                  ) : (
                    <>
                      {addresses.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-dp-text-tertiary">Saved address</p>
                          {addresses.map((addr) => (
                            <label key={addr.id} className={`flex cursor-pointer gap-3 rounded-sm border p-3 text-[12px] ${addressMode === "saved" && selectedAddressId === addr.id ? "border-dp-accent-gold bg-dp-accent-gold/10" : "border-dp-border bg-dp-bg-elevated"}`}>
                              <input
                                type="radio"
                                checked={addressMode === "saved" && selectedAddressId === addr.id}
                                onChange={() => {
                                  setAddressMode("saved")
                                  setSelectedAddressId(addr.id)
                                }}
                              />
                              <span>
                                <strong className="block text-dp-text-primary">{addr.label}</strong>
                                <span className="text-dp-text-secondary">{addr.line1}, {addr.city}, {addr.country}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      <label className={`flex cursor-pointer gap-3 rounded-sm border p-3 text-[12px] ${addressMode === "new" ? "border-dp-accent-gold bg-dp-accent-gold/10" : "border-dp-border bg-dp-bg-elevated"}`}>
                        <input type="radio" checked={addressMode === "new"} onChange={() => setAddressMode("new")} />
                        <span className="font-semibold text-dp-text-primary">Add a new address</span>
                      </label>
                      {addressMode === "new" && (
                        <div className="grid grid-cols-2 gap-2">
                          <input value={addressForm.line1} onChange={(e) => setAddressForm((f) => ({ ...f, line1: e.target.value }))} placeholder="Street address" className="col-span-2 rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[12px] text-dp-text-primary" />
                          <input value={addressForm.city} onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))} placeholder="City" className="rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[12px] text-dp-text-primary" />
                          <input value={addressForm.state} onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))} placeholder="State / Region" className="rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[12px] text-dp-text-primary" />
                          <input value={addressForm.zip_code} onChange={(e) => setAddressForm((f) => ({ ...f, zip_code: e.target.value }))} placeholder="ZIP / Postal code" className="rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[12px] text-dp-text-primary" />
                          <select value={addressForm.country} onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))} className="rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[12px] text-dp-text-primary">
                            {CHECKOUT_COUNTRIES.map((country) => (
                              <option key={country.code} value={country.code}>{country.name}</option>
                            ))}
                          </select>
                          <input value={addressForm.phone} onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="col-span-2 rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[12px] text-dp-text-primary" />
                          <label className="col-span-2 flex items-center gap-2 text-[12px] text-dp-text-secondary">
                            <input type="checkbox" checked={addressForm.save_address} onChange={(e) => setAddressForm((f) => ({ ...f, save_address: e.target.checked }))} />
                            Save this address to my profile
                          </label>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-dp-text-tertiary">Shipping</p>
                          <span className="text-[10px] font-black uppercase tracking-widest text-dp-accent-gold">
                            {activeShippingCountry().toUpperCase() === "GE" ? "Georgian market · GEL" : "Other markets · USD"}
                          </span>
                        </div>
                        {shippingLoading && <div className="h-14 animate-pulse rounded-sm bg-dp-bg-elevated" />}
                        {!shippingLoading && shippingOptions.map((opt) => (
                          <label key={opt.slug} className={`flex cursor-pointer items-start justify-between gap-3 rounded-sm border p-3 text-[12px] ${shippingSlug === opt.slug ? "border-dp-accent-gold bg-dp-accent-gold/10" : "border-dp-border bg-dp-bg-elevated"}`}>
                            <span className="flex gap-3">
                              <input type="radio" checked={shippingSlug === opt.slug} onChange={() => setShippingSlug(opt.slug)} />
                              <span>
                                <strong className="block text-dp-text-primary">{opt.label}</strong>
                                <span className="text-dp-text-secondary">{opt.is_pickup ? "No shipping address handoff needed." : `${opt.est_days_min}-${opt.est_days_max} business days`}</span>
                              </span>
                            </span>
                            <span className="text-right font-black text-dp-text-primary">
                              {Number(opt.price) > 0 ? `${opt.price} ${opt.currency}` : "Free"}
                              {opt.requires_payment && <span className="block text-[10px] font-normal text-dp-accent-cta">payment required</span>}
                            </span>
                          </label>
                        ))}
                        {!shippingLoading && shippingOptions.length === 0 && (
                          <p className="rounded-sm border border-dp-accent-cta/30 bg-dp-accent-cta/10 px-3 py-2 text-[12px] text-dp-accent-cta">
                            No shipping options are active for this vendor and country.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmItem(null)} className="rounded-sm border border-dp-border px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-dp-text-secondary">
                  No, go back
                </button>
                <button
                  type="button"
                  disabled={
                    buyingId === confirmItem.id
                    || (confirmItem.item_type === "physical" && (!shippingSlug || (addressMode === "new" && !newAddressIsComplete()) || (addressMode === "saved" && !selectedAddressId)))
                  }
                  onClick={() => purchase(confirmItem)}
                  className="rounded-sm bg-dp-accent-cta px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-60"
                >
                  {buyingId === confirmItem.id ? "Processing..." : confirmItem.item_type === "physical" ? "Confirm details" : "Yes, buy"}
                </button>
              </div>
            </div>
          </div>
        )}
        {voucherResult && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-sm border border-dp-accent-gold/40 bg-dp-bg-surface p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-dp-success">Voucher ready</p>
                  <h3 className="font-display text-2xl text-dp-text-primary mt-1">{voucherResult.label}</h3>
                </div>
                <button type="button" onClick={() => setVoucherResult(null)} className="text-dp-text-tertiary hover:text-dp-text-primary">
                  <X size={18} />
                </button>
              </div>
              <p className="mt-4 text-[13px] text-dp-text-secondary">Use this promo code once at checkout on eligible non-sale products.</p>
              <button
                type="button"
                onClick={() => copyText(voucherResult.code)}
                className="mt-4 flex w-full items-center justify-between rounded-sm border border-dp-accent-gold/50 bg-dp-accent-gold/10 px-4 py-3 font-mono text-lg font-black text-dp-accent-gold"
              >
                {voucherResult.code}
                <Copy size={17} />
              </button>
              <button type="button" onClick={() => setVoucherResult(null)} className="mt-4 w-full rounded-sm bg-dp-accent-cta px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white">
                Back to market
              </button>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  )
}
