"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import LocalizedLink from "@/components/seo/LocalizedLink"
import { ChevronRight, CreditCard, CheckCircle, Lock, Truck, ArrowLeft, MapPin, Package } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { authFetch, getApiErrorMessage } from "@/lib/api"
import { useRequireAuth } from "@/hooks/useRequireAuth"
import { useLocale } from "@/contexts/locale-context"
import { CartItemExtras } from "@/components/cart/CartItemExtras"
import { PromoCodeBox } from "@/components/cart/PromoCodeBox"
import { useAuth } from "@/contexts/auth-context"
import { CHECKOUT_COUNTRIES } from "@/lib/countries"

type DeliveryOpt = {
  id: number
  slug: string
  label: string
  vendor_id?: number
  vendor_name?: string
  price?: string
  price_gel: string
  price_usd: string
  est_days_min: number
  est_days_max: number
  is_express?: boolean
  is_pickup?: boolean
}

type Step = "shipping" | "payment" | "review" | "confirmed"
type Address = { id: number; label: string; line1: string; line2: string; city: string; state: string; zip_code: string; country: string; is_default: boolean }

function discountLabel(cart: ReturnType<typeof useCart>["cart"]): string {
  if (!cart) return "Discount"
  if (cart.applied_discount_source === "tier") {
    return `Sale tier bonus${cart.tier_discount_percent ? ` (+${parseFloat(cart.tier_discount_percent).toFixed(0)}%)` : ""}`
  }
  if (cart.applied_discount_source === "tier_voucher") {
    return "Sale tier bonus + voucher"
  }
  if (cart.applied_discount_source === "voucher") {
    return `Voucher discount${cart.promo_code_str ? ` (${cart.promo_code_str})` : ""}`
  }
  return `Discount${cart.promo_code_str ? ` (${cart.promo_code_str})` : ""}`
}

function shippingPriceLabel(opt: DeliveryOpt, currency: string): string {
  const amount = parseFloat(opt.price ?? (currency === "GEL" ? opt.price_gel : opt.price_usd) ?? "0")
  if (amount === 0) return "Free"
  return currency === "GEL" ? `₾${amount.toFixed(2)}` : `$${amount.toFixed(2)}`
}

function StepBar({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "shipping", label: "Shipping" },
    { id: "payment",  label: "Payment"  },
    { id: "review",   label: "Review"   },
    { id: "confirmed",label: "Done"     },
  ]
  const idx = steps.findIndex((s) => s.id === current)

  return (
    <nav aria-label="Checkout progress" className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => {
        const done    = i < idx
        const active  = i === idx
        return (
          <div key={step.id} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex flex-col items-center shrink-0">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors ${
                  done   ? "bg-dp-success border-dp-success text-white"
                  : active ? "bg-dp-accent-cta border-dp-accent-cta text-white"
                  : "bg-dp-bg-elevated border-dp-border text-dp-text-tertiary"
                }`}
              >
                {done ? <CheckCircle size={13} /> : i + 1}
              </span>
              <span className={`text-[10px] mt-1 uppercase tracking-widest whitespace-nowrap ${active ? "text-dp-text-primary font-semibold" : "text-dp-text-tertiary"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 transition-colors ${i < idx ? "bg-dp-success" : "bg-dp-border"}`} aria-hidden />
            )}
          </div>
        )
      })}
    </nav>
  )
}

function Field({
  label, id, type = "text", placeholder, autoComplete, required = true,
  value, onChange,
}: {
  label: string; id: string; type?: string; placeholder?: string
  autoComplete?: string; required?: boolean; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">
        {label}{required && " *"}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
      />
    </div>
  )
}

function GeoPricingModal({
  country, currency, loading, onContinue,
}: {
  country: string; currency: string; loading?: boolean; onContinue: () => void
}) {
  const isGE = country === "GE"
  const countryLabel = isGE ? "Georgia 🇬🇪" : country
  const currencyLabel = isGE ? "Georgian Lari (₾ GEL)" : `USD ($)`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl">
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <MapPin size={22} className="text-dp-accent-cta shrink-0 mt-0.5" />
          <div>
            <p className="text-[15px] font-bold text-dp-text-primary">Prices updated for {countryLabel}</p>
            <p className="text-[13px] text-dp-text-secondary mt-1 leading-relaxed">
              Your delivery address is in <strong className="text-dp-text-primary">{countryLabel}</strong>. Cart totals will switch to the admin <strong className="text-dp-text-primary">{currencyLabel}</strong> market prices for that region (no currency conversion).
            </p>
          </div>
        </div>
        <div className="px-6 pb-5">
          <button
            onClick={onContinue}
            disabled={loading}
            className="w-full py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors"
          >
            {loading ? "Updating prices…" : `Continue with ${currency} prices`}
          </button>
        </div>
      </div>
    </div>
  )
}

// Group delivery options by vendor
type VendorGroup = {
  vendorId: number
  vendorName: string
  options: DeliveryOpt[]
}

function groupOptionsByVendor(options: DeliveryOpt[]): VendorGroup[] {
  const map = new Map<number, VendorGroup>()
  for (const opt of options) {
    const vid = opt.vendor_id ?? 0
    if (!map.has(vid)) {
      map.set(vid, { vendorId: vid, vendorName: opt.vendor_name ?? "", options: [] })
    }
    map.get(vid)!.options.push(opt)
  }
  return Array.from(map.values())
}

function PerVendorShippingSelector({
  groups,
  selections,
  onChange,
  currency,
  loading,
}: {
  groups: VendorGroup[]
  selections: Record<string, string>
  onChange: (vendorId: number, slug: string) => void
  currency: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="px-4 py-3 border border-dp-border rounded-sm bg-dp-bg-elevated text-[12px] text-dp-text-tertiary">
        Loading shipping methods...
      </div>
    )
  }
  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary">Shipping Method</p>
      {groups.map((group) => (
        <div key={group.vendorId} className="flex flex-col gap-2">
          {groups.length > 1 && (
            <div className="flex items-center gap-2">
              <Package size={13} className="text-dp-accent-cta" />
              <span className="text-[12px] font-semibold text-dp-text-primary">{group.vendorName}</span>
            </div>
          )}
          {group.options.map((opt) => (
            <label
              key={opt.slug}
              className={`flex items-center justify-between gap-3 px-4 py-3 border rounded-sm cursor-pointer transition-colors ${
                selections[String(group.vendorId)] === opt.slug
                  ? "border-dp-accent-cta bg-dp-accent-cta/5"
                  : "border-dp-border hover:border-dp-border-hover"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`delivery-${group.vendorId}`}
                  value={opt.slug}
                  checked={selections[String(group.vendorId)] === opt.slug}
                  onChange={() => onChange(group.vendorId, opt.slug)}
                  className="accent-dp-accent-cta"
                />
                <div>
                  <p className="text-[13px] font-semibold text-dp-text-primary">
                    {opt.label}
                    {opt.is_express && <span className="ml-1.5 text-[10px] font-bold text-dp-accent-cta">EXPRESS</span>}
                  </p>
                  {groups.length <= 1 && opt.vendor_name && <p className="text-[11px] text-dp-text-secondary">{opt.vendor_name}</p>}
                  <p className="text-[11px] text-dp-text-tertiary">
                    {opt.is_pickup ? "Collect it yourself after confirmation" : `${opt.est_days_min}-${opt.est_days_max} business days`}
                  </p>
                </div>
              </div>
              <span className="text-[13px] font-bold text-dp-text-primary">{shippingPriceLabel(opt, currency)}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}

function ShippingForm({
  onNext, onCountryChange,
  deliveryOptions, shippingSelections, onShippingSelectionChange,
  deliveryLoading, vendorGroups,
}: {
  onNext: (data: Record<string, string>, country: string) => void
  onCountryChange: (country: string) => void
  deliveryOptions: DeliveryOpt[]
  shippingSelections: Record<string, string>
  onShippingSelectionChange: (vendorId: number, slug: string) => void
  deliveryLoading: boolean
  vendorGroups: VendorGroup[]
}) {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new">("new")
  const [f, setF] = useState({
    name: "", streetAddress: "", country: "US", state: "", zipCode: "",
    email: user?.email ?? "", phone: "",
  })
  const set = (key: keyof typeof f) => (v: string) => {
    setF((p) => ({ ...p, [key]: v }))
    if (key === "country") onCountryChange(v)
  }
  const shippingCurrency = f.country === "GE" ? "GEL" : "USD"

  useEffect(() => {
    setF((prev) => ({ ...prev, email: user?.email ?? prev.email }))
  }, [user?.email])

  useEffect(() => {
    let cancelled = false
    authFetch<Address[]>("/auth/addresses/")
      .then((d) => {
        if (cancelled) return
        const list = Array.isArray(d) ? d : (d as { results?: Address[] }).results ?? []
        setAddresses(list)
        const def = list.find((addr) => addr.is_default) ?? list[0]
        if (def) applyAddress(def)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function applyAddress(addr: Address) {
    setSelectedAddressId(addr.id)
    setF((prev) => ({
      ...prev,
      streetAddress: addr.line1,
      country: addr.country,
      state: addr.state || addr.city,
      zipCode: addr.zip_code,
    }))
    onCountryChange(addr.country)
  }

  async function saveCheckoutAddress() {
    if (selectedAddressId !== "new") return
    await authFetch("/auth/addresses/", {
      method: "POST",
      body: JSON.stringify({
        label: "Checkout",
        line1: f.streetAddress,
        line2: "",
        city: f.state,
        state: f.state,
        zip_code: f.zipCode,
        country: f.country,
        is_default: addresses.length === 0,
      }),
    }).catch(() => {})
  }

  const allVendorsHaveSelection = vendorGroups.length === 0 || vendorGroups.every(
    (g) => Boolean(shippingSelections[String(g.vendorId)])
  )
  const valid = Object.values(f).every(Boolean) && !deliveryLoading && allVendorsHaveSelection

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid) return
        await saveCheckoutAddress()
        onNext({
          shipping_name: f.name,
          shipping_line1: f.streetAddress,
          shipping_city: f.state,
          shipping_state: f.state,
          shipping_zip: f.zipCode,
          shipping_country: f.country,
          shipping_email: user?.email ?? f.email,
          shipping_phone: f.phone,
        }, f.country)
      }}
      className="flex flex-col gap-4"
      aria-label="Shipping information"
    >
      <h2 className="font-display text-3xl text-dp-text-primary">Shipping Information</h2>

      {addresses.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary">Saved addresses</p>
          {addresses.map((addr) => (
            <label key={addr.id} className={`flex items-start gap-3 px-4 py-3 border rounded-sm cursor-pointer transition-colors ${selectedAddressId === addr.id ? "border-dp-accent-cta bg-dp-accent-cta/5" : "border-dp-border hover:border-dp-border-hover"}`}>
              <input type="radio" className="mt-1 accent-dp-accent-cta" checked={selectedAddressId === addr.id} onChange={() => applyAddress(addr)} />
              <span className="text-[12px] text-dp-text-secondary">
                <strong className="text-dp-text-primary">{addr.label}</strong> · {addr.line1}, {addr.city || addr.state} {addr.zip_code}, {addr.country}
              </span>
            </label>
          ))}
          <label className={`flex items-center gap-3 px-4 py-3 border rounded-sm cursor-pointer transition-colors ${selectedAddressId === "new" ? "border-dp-accent-cta bg-dp-accent-cta/5" : "border-dp-border hover:border-dp-border-hover"}`}>
            <input type="radio" className="accent-dp-accent-cta" checked={selectedAddressId === "new"} onChange={() => setSelectedAddressId("new")} />
            <span className="text-[13px] font-semibold text-dp-text-primary">Add a new address</span>
          </label>
        </div>
      )}

      <Field label="Full Name" id="name" autoComplete="name" placeholder="First and last name" value={f.name} onChange={set("name")} />
      <Field label="Street Address" id="streetAddress" autoComplete="street-address" placeholder="123 Main Street, Apt 4B" value={f.streetAddress} onChange={set("streetAddress")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="country" className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">
            Country *
          </label>
          <select
            id="country"
            value={f.country}
            onChange={(e) => set("country")(e.target.value)}
            className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
          >
            {CHECKOUT_COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>{country.name}</option>
            ))}
          </select>
        </div>
        <Field label="State / Region" id="state" autoComplete="address-level1" placeholder="e.g. New York" value={f.state} onChange={set("state")} />
      </div>

      <Field label="ZIP / Postal Code" id="zipCode" autoComplete="postal-code" placeholder="e.g. 10001" value={f.zipCode} onChange={set("zipCode")} />
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Email Address *</label>
        <input id="email" type="email" readOnly value={user?.email ?? f.email} className="px-3 py-2.5 bg-dp-bg-elevated/70 border border-dp-border rounded-sm text-[13px] text-dp-text-secondary cursor-not-allowed" />
        <p className="text-[11px] text-dp-text-tertiary">Checkout uses the email registered on your profile.</p>
      </div>

      <PerVendorShippingSelector
        groups={vendorGroups}
        selections={shippingSelections}
        onChange={onShippingSelectionChange}
        currency={shippingCurrency}
        loading={deliveryLoading}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">
          Phone Number *
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 000 0000"
          required
          value={f.phone}
          onChange={(e) => set("phone")(e.target.value)}
          className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
        />
        <p className="text-[11px] text-dp-text-tertiary leading-relaxed mt-0.5">
          We need your phone number because it will be attached to the parcel — the courier may contact you for delivery.
        </p>
      </div>

      <button
        type="submit"
        disabled={!valid}
        className="flex items-center justify-center gap-2 w-full py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors mt-2"
      >
        Continue to Payment <ChevronRight size={14} aria-hidden />
      </button>
    </form>
  )
}

type PaymentMethod = { id: number; brand: string; last4: string; exp_month: number; exp_year: number; is_default: boolean }

export type CheckoutPaymentData = {
  paymentMethodId?: number | null
  saveCard?: boolean
  brand?: string
  last4?: string
  exp_month?: number
  exp_year?: number
  is_default?: boolean
}

function cardBrandFromNumber(num: string): string {
  const d = num.replace(/\D/g, "")
  if (d.startsWith("4")) return "visa"
  if (d.startsWith("5")) return "mastercard"
  if (d.startsWith("3")) return "amex"
  return "visa"
}

function PaymentForm({
  onNext, onBack,
}: {
  onNext: (data: CheckoutPaymentData) => void
  onBack: () => void
}) {
  const [f, setF] = useState({ cardNumber: "", name: "", expiry: "", cvc: "" })
  const [cards, setCards] = useState<PaymentMethod[]>([])
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [useNewCard, setUseNewCard] = useState(false)
  const [saveCard, setSaveCard] = useState(true)
  const [setDefault, setSetDefault] = useState(false)
  const set = (key: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [key]: v }))
  const validNew = Object.values(f).every(Boolean)
  const valid = useNewCard ? validNew : selectedCardId != null

  useEffect(() => {
    authFetch<PaymentMethod[]>("/auth/payment-methods/")
      .then((d) => {
        const list = Array.isArray(d) ? d : (d as { results?: PaymentMethod[] }).results ?? []
        setCards(list)
        const def = list.find((c) => c.is_default) ?? list[0]
        if (def) {
          setSelectedCardId(def.id)
          setUseNewCard(false)
        } else {
          setUseNewCard(true)
        }
      })
      .catch(() => setUseNewCard(true))
  }, [])

  const handleCard = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16)
    const groups = digits.match(/.{1,4}/g) ?? []
    setF((p) => ({ ...p, cardNumber: groups.join(" ") }))
  }
  const handleExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4)
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
    setF((p) => ({ ...p, expiry: formatted }))
  }

  function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    if (!useNewCard && selectedCardId != null) {
      onNext({ paymentMethodId: selectedCardId })
      return
    }
    const digits = f.cardNumber.replace(/\D/g, "")
    const [mm, yy] = f.expiry.split("/")
    onNext({
      saveCard,
      brand: cardBrandFromNumber(digits),
      last4: digits.slice(-4),
      exp_month: parseInt(mm, 10),
      exp_year: 2000 + parseInt(yy, 10),
      is_default: setDefault || cards.length === 0,
    })
  }

  return (
    <form onSubmit={submitPayment} className="flex flex-col gap-4" aria-label="Payment information">
      <h2 className="font-display text-3xl text-dp-text-primary">Payment</h2>

      <div className="flex items-center gap-2 text-[12px] text-dp-text-tertiary">
        <Lock size={13} className="text-dp-success" aria-hidden />
        <span>All transactions are encrypted and secure</span>
      </div>

      {cards.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary">Saved cards</p>
          {cards.map((c) => (
            <label key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 border rounded-sm cursor-pointer transition-colors ${!useNewCard && selectedCardId === c.id ? "border-dp-accent-cta bg-dp-accent-cta/5" : "border-dp-border hover:border-dp-border-hover"}`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="savedCard" checked={!useNewCard && selectedCardId === c.id} onChange={() => { setUseNewCard(false); setSelectedCardId(c.id) }} />
                <span className="text-[13px] font-semibold text-dp-text-primary uppercase">{c.brand}</span>
                <span className="text-[13px] text-dp-text-secondary">•••• {c.last4}</span>
                {c.is_default && <span className="text-[10px] font-bold uppercase text-dp-accent-gold">Default</span>}
              </div>
              <span className="text-[12px] text-dp-text-tertiary">{String(c.exp_month).padStart(2, "0")}/{c.exp_year}</span>
            </label>
          ))}
          <label className={`flex items-center gap-3 px-4 py-3 border rounded-sm cursor-pointer transition-colors ${useNewCard ? "border-dp-accent-cta bg-dp-accent-cta/5" : "border-dp-border hover:border-dp-border-hover"}`}>
            <input type="radio" name="savedCard" checked={useNewCard} onChange={() => setUseNewCard(true)} />
            <span className="text-[13px] font-semibold text-dp-text-primary">Use a new card</span>
          </label>
        </div>
      )}

      {useNewCard && (
        <>
          <div className="relative">
            <Field label="Card Number" id="cardNumber" type="text" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={f.cardNumber} onChange={handleCard} />
            <CreditCard size={16} className="absolute right-3 bottom-2.5 text-dp-text-tertiary" aria-hidden />
          </div>
          <Field label="Name on Card" id="cardName" autoComplete="cc-name" placeholder="Full name as on card" value={f.name} onChange={set("name")} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expiry (MM/YY)" id="expiry" autoComplete="cc-exp" placeholder="MM/YY" value={f.expiry} onChange={handleExpiry} />
            <Field label="CVC" id="cvc" autoComplete="cc-sc" placeholder="123" value={f.cvc} onChange={set("cvc")} />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-dp-text-secondary">
            <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
            Save this card for future purchases
          </label>
          {saveCard && (
            <label className="flex items-center gap-2 text-[13px] text-dp-text-secondary">
              <input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} />
              Set as default payment method
            </label>
          )}
        </>
      )}

      <div className="flex items-center gap-3 pt-1">
        <span className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Accepted:</span>
        {["Visa", "MC", "Amex", "PayPal"].map((c) => (
          <span key={c} className="px-2.5 py-0.5 border border-dp-border rounded-sm text-[10px] font-bold text-dp-text-tertiary uppercase tracking-widest">{c}</span>
        ))}
      </div>

      <div className="flex gap-3 mt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 px-4 py-3 border border-dp-border rounded-sm text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
          <ArrowLeft size={13} /> Back
        </button>
        <button type="submit" disabled={!valid} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors">
          Review Order <ChevronRight size={14} aria-hidden />
        </button>
      </div>
    </form>
  )
}

function ReviewStep({
  onConfirm, onBack, shippingData, checkoutCurrency, paymentData,
  shippingSelections, deliveryOptions,
}: {
  onConfirm: (orderNum: string, orderId: string) => void
  onBack: () => void
  shippingData: Record<string, string>
  checkoutCurrency: string
  paymentData: CheckoutPaymentData | null
  shippingSelections: Record<string, string>
  deliveryOptions: DeliveryOpt[]
}) {
  const { cart, refresh } = useCart()
  const { formatPrice } = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const checkoutIdempotencyKey = useRef("")

  if (!checkoutIdempotencyKey.current) {
    checkoutIdempotencyKey.current = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  const items = cart?.items ?? []
  const giftWrapTotal = items.reduce((sum, item) => sum + (item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0), 0)
  const processingTotal = items.reduce((sum, item) => sum + (item.processing_option ? parseFloat(item.processing_fee || "0") : 0), 0)
  const productsTotal = items.reduce((sum, item) => {
    const unit = parseFloat(item.unit_price || "0")
    if (unit > 0) return sum + unit * item.quantity
    const line = parseFloat(item.line_total || "0")
    const wrap = item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0
    const proc = item.processing_option ? parseFloat(item.processing_fee || "0") : 0
    return sum + Math.max(0, line - wrap - proc)
  }, 0)

  // Sum delivery from all vendor selections
  const deliveryPrice = useMemo(() => {
    let total = 0
    for (const slug of Object.values(shippingSelections)) {
      const opt = deliveryOptions.find((o) => o.slug === slug)
      if (opt) total += parseFloat(opt.price ?? (checkoutCurrency === "GEL" ? opt.price_gel : opt.price_usd) ?? "0")
    }
    return total
  }, [shippingSelections, deliveryOptions, checkoutCurrency])

  const discount = parseFloat(cart?.discount || "0")
  const total = Math.max(0, productsTotal + giftWrapTotal + processingTotal - discount + deliveryPrice)

  const hasVendorShippingSelection = Object.keys(shippingSelections).length > 0

  async function handlePlaceOrder() {
    setLoading(true)
    setError("")
    try {
      if (paymentData?.saveCard && paymentData.last4 && paymentData.exp_month && paymentData.exp_year) {
        await authFetch("/auth/payment-methods/", {
          method: "POST",
          body: JSON.stringify({
            brand: paymentData.brand ?? "visa",
            last4: paymentData.last4,
            exp_month: paymentData.exp_month,
            exp_year: paymentData.exp_year,
            is_default: paymentData.is_default ?? false,
          }),
        }).catch(() => {})
      }
      type OrderResponse = { id: string; order_number: string }
      const checkoutBody: Record<string, unknown> = {
        ...shippingData,
        currency: checkoutCurrency,
      }

      if (hasVendorShippingSelection) {
        checkoutBody.shipping_selections = shippingSelections
        checkoutBody.delivery_type = "per-vendor"
      } else {
        checkoutBody.delivery_type = "standard"
      }

      const order = await authFetch<OrderResponse>("/orders/checkout/", {
        method: "POST",
        headers: { "Idempotency-Key": checkoutIdempotencyKey.current },
        body: JSON.stringify(checkoutBody),
      })
      await authFetch("/orders/cart/", { method: "DELETE" }).catch(() => {})
      await refresh()
      onConfirm(order.order_number, order.id)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Checkout failed. Please check your connection and try again."))
    } finally {
      setLoading(false)
    }
  }

  // Group selected shipping for display
  const shippingLines = useMemo(() => {
    const lines: { label: string; vendorName: string; price: number }[] = []
    for (const [, slug] of Object.entries(shippingSelections)) {
      const opt = deliveryOptions.find((o) => o.slug === slug)
      if (opt) {
        lines.push({
          label: opt.label,
          vendorName: opt.vendor_name ?? "",
          price: parseFloat(opt.price ?? (checkoutCurrency === "GEL" ? opt.price_gel : opt.price_usd) ?? "0"),
        })
      }
    }
    return lines
  }, [shippingSelections, deliveryOptions, checkoutCurrency])

  return (
    <div className="flex flex-col gap-5" aria-label="Order review">
      <h2 className="font-display text-3xl text-dp-text-primary">Review Order</h2>
      {error && <p className="text-[12px] text-dp-accent-cta bg-dp-accent-cta/10 px-4 py-2 rounded-sm">{error}</p>}

      <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 px-4 py-4 border-b border-dp-border last:border-b-0">
            <div className="relative w-14 h-20 shrink-0 rounded-sm overflow-hidden">
              <Image src={item.product_image || "/placeholder.svg"} alt={item.product_title} fill className="object-cover" sizes="56px" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-dp-text-primary truncate mt-0.5">{item.product_title}</p>
              <p className="text-[12px] text-dp-text-tertiary">
                {item.size_label ? `${item.size_label} · ` : ""}Qty {item.quantity}
              </p>
              <CartItemExtras item={item} formatPrice={formatPrice} compact />
            </div>
            <span className="text-[15px] font-bold text-dp-text-primary shrink-0">{formatPrice(parseFloat(item.line_total))}</span>
          </div>
        ))}

        <div className="px-4 py-3 flex flex-col gap-1.5 bg-dp-bg-elevated border-t border-dp-border">
          <div className="flex justify-between text-[13px]">
            <span className="text-dp-text-secondary">Products</span>
            <span className="text-dp-text-primary font-semibold">{formatPrice(productsTotal)}</span>
          </div>
          {processingTotal > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-dp-text-secondary">Processing</span>
              <span className="text-dp-text-primary font-semibold">{formatPrice(processingTotal)}</span>
            </div>
          )}
          {giftWrapTotal > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-dp-text-secondary">Gift wrap</span>
              <span className="text-dp-text-primary font-semibold">{formatPrice(giftWrapTotal)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[13px] text-dp-success">
                <span>
                  {discountLabel(cart)}
                  {cart?.promo_products_only && cart.applied_discount_source === "voucher" ? " · products" : ""}
                </span>
                <span className="font-semibold">−{formatPrice(discount)}</span>
              </div>
              {cart?.discount_message && (
                <p className="text-[11px] text-dp-text-tertiary leading-relaxed">{cart.discount_message}</p>
              )}
            </div>
          )}
          {shippingLines.map((line, i) => (
            <div key={i} className="flex justify-between text-[13px]">
              <span className="text-dp-text-secondary">
                Shipping{line.vendorName && shippingLines.length > 1 ? ` · ${line.vendorName}` : ""}
                <span className="text-dp-text-tertiary text-[11px] ml-1">({line.label})</span>
              </span>
              <span className="text-dp-text-primary font-semibold">
                {line.price === 0 ? "Free" : `+${formatPrice(line.price)}`}
              </span>
            </div>
          ))}
          {shippingLines.length === 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-dp-text-secondary">Shipping</span>
              <span className="text-dp-text-primary font-semibold">Free</span>
            </div>
          )}
          {checkoutCurrency !== "USD" && (
            <div className="flex justify-between text-[11px]">
              <span className="text-dp-text-tertiary">Currency</span>
              <span className="text-dp-accent-cta font-semibold">{checkoutCurrency}</span>
            </div>
          )}
          <div className="flex justify-between text-[15px] font-bold pt-1 border-t border-dp-border mt-1">
            <span className="text-dp-text-primary">Total</span>
            <span className="font-display text-2xl text-dp-text-primary">{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-1">
        <button onClick={onBack} className="flex items-center gap-1 px-4 py-3 border border-dp-border rounded-sm text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
          <ArrowLeft size={13} /> Back
        </button>
        <button
          onClick={handlePlaceOrder}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors"
        >
          {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock size={14} />}
          {loading ? "Placing…" : "Place Order"}
        </button>
      </div>
    </div>
  )
}

function Confirmed({ orderNumber, orderId }: { orderNumber: string; orderId?: string }) {
  const detailHref = orderId ? `/account/orders/${orderId}` : "/account/orders"
  return (
    <div className="flex flex-col items-center text-center gap-6 py-12">
      <div className="w-20 h-20 rounded-full bg-dp-success/15 flex items-center justify-center">
        <CheckCircle size={40} className="text-dp-success" />
      </div>
      <div>
        <h2 className="font-display text-5xl text-dp-text-primary mb-2">Order Placed!</h2>
        <p className="text-dp-text-secondary text-sm max-w-sm mx-auto leading-relaxed">
          Your metal posters are now being printed. Confirmation sent to your email.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <LocalizedLink href={detailHref} className="px-6 py-3 border border-dp-border rounded-sm text-[12px] font-bold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
          View Order
        </LocalizedLink>
        <LocalizedLink href="/catalog" className="flex items-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
          Keep Shopping <ChevronRight size={13} aria-hidden />
        </LocalizedLink>
      </div>
      <div className="flex items-center gap-3 border border-dp-accent-gold/30 bg-dp-accent-gold/5 rounded-sm px-6 py-4 mt-2">
        <Truck size={20} className="text-dp-accent-gold shrink-0" />
        <div className="text-left">
          <p className="text-[13px] font-semibold text-dp-text-primary">Ships within 3–5 business days</p>
          <p className="text-[12px] text-dp-text-tertiary">Order {orderNumber}</p>
        </div>
      </div>
    </div>
  )
}

function OrderAside({
  deliveryPrice = 0,
  showShipping = false,
}: {
  deliveryPrice?: number
  showShipping?: boolean
}) {
  const { cart } = useCart()
  const { formatPrice } = useLocale()
  const items = cart?.items ?? []
  const giftWrapTotal = items.reduce((sum, item) => sum + (item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0), 0)
  const processingTotal = items.reduce((sum, item) => sum + (item.processing_option ? parseFloat(item.processing_fee || "0") : 0), 0)
  const productsTotal = items.reduce((sum, item) => {
    const unit = parseFloat(item.unit_price || "0")
    if (unit > 0) return sum + unit * item.quantity
    const line = parseFloat(item.line_total || "0")
    const wrap = item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0
    const proc = item.processing_option ? parseFloat(item.processing_fee || "0") : 0
    return sum + Math.max(0, line - wrap - proc)
  }, 0)
  const discount = parseFloat(cart?.discount || "0")
  const shipping = showShipping ? deliveryPrice : 0
  const total = Math.max(0, productsTotal + giftWrapTotal + processingTotal - discount + shipping)

  return (
    <aside className="lg:w-80 xl:w-96 shrink-0 sticky top-24 self-start" aria-label="Order summary">
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-dp-border">
          <h3 className="font-display text-xl text-dp-text-primary">Your Order</h3>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="relative w-10 h-14 shrink-0 rounded-sm overflow-hidden border border-dp-border">
                <Image src={item.product_image || "/placeholder.svg"} alt={item.product_title} fill className="object-cover" sizes="40px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-dp-text-primary truncate">{item.product_title}</p>
                <p className="text-[11px] text-dp-text-tertiary">
                  {item.size_label ? `${item.size_label} · ` : ""}Qty {item.quantity}
                </p>
                <CartItemExtras item={item} formatPrice={formatPrice} compact />
              </div>
              <span className="text-[13px] font-bold text-dp-text-primary shrink-0">{formatPrice(parseFloat(item.line_total))}</span>
            </div>
          ))}
          <div className="border-t border-dp-border pt-3 flex flex-col gap-2">
            <PromoCodeBox compact />
            <div className="flex justify-between text-[12px]">
              <span className="text-dp-text-tertiary">Products</span>
              <span className="text-dp-text-secondary">{formatPrice(productsTotal)}</span>
            </div>
            {processingTotal > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-dp-text-tertiary">Processing</span>
                <span className="text-dp-text-secondary">{formatPrice(processingTotal)}</span>
              </div>
            )}
            {giftWrapTotal > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-dp-text-tertiary">Gift wrap</span>
                <span className="text-dp-text-secondary">{formatPrice(giftWrapTotal)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[12px] text-dp-success">
                  <span>
                    {discountLabel(cart)}
                    {cart?.promo_products_only && cart.applied_discount_source === "voucher" ? " · products" : ""}
                  </span>
                  <span>−{formatPrice(discount)}</span>
                </div>
                {cart?.discount_message && (
                  <p className="text-[11px] text-dp-text-tertiary leading-relaxed">{cart.discount_message}</p>
                )}
              </div>
            )}
            {showShipping && (
              <div className="flex justify-between text-[12px]">
                <span className="text-dp-text-tertiary">Shipping</span>
                <span className="text-dp-text-secondary">
                  {shipping === 0 ? "Free" : `+${formatPrice(shipping)}`}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-dp-border">
              <span className="text-[13px] font-bold text-dp-text-primary">Total</span>
              <span className="font-display text-xl text-dp-text-primary">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function CheckoutPage(): React.ReactElement {
  useRequireAuth()
  const { repriceCart } = useCart()
  const { setCurrency, currency } = useLocale()
  const [step, setStep] = useState<Step>("shipping")
  const [shippingData, setShippingData] = useState<Record<string, string>>({})
  const [confirmedOrder, setConfirmedOrder] = useState("")
  const [confirmedOrderId, setConfirmedOrderId] = useState("")
  const [showGeoModal, setShowGeoModal] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [pendingShippingData, setPendingShippingData] = useState<Record<string, string>>({})
  const [pendingCountry, setPendingCountry] = useState("")
  const [checkoutCurrency, setCheckoutCurrency] = useState("USD")
  const [paymentData, setPaymentData] = useState<CheckoutPaymentData | null>(null)

  // Per-vendor shipping
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({})
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOpt[]>([])
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [shippingCountryDraft, setShippingCountryDraft] = useState("US")

  const vendorGroups = useMemo(() => groupOptionsByVendor(deliveryOptions), [deliveryOptions])

  useEffect(() => {
    if (!shippingCountryDraft) {
      setDeliveryOptions([])
      setShippingSelections({})
      return
    }
    setDeliveryLoading(true)
    authFetch<DeliveryOpt[]>(`/orders/cart/shipping-options/?country=${encodeURIComponent(shippingCountryDraft)}`)
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setDeliveryOptions(d)
          // Auto-select first option per vendor
          const groups = groupOptionsByVendor(d)
          const newSelections: Record<string, string> = {}
          for (const g of groups) {
            const existing = shippingSelections[String(g.vendorId)]
            if (existing && g.options.some((o) => o.slug === existing)) {
              newSelections[String(g.vendorId)] = existing
            } else {
              newSelections[String(g.vendorId)] = g.options[0].slug
            }
          }
          setShippingSelections(newSelections)
        } else {
          setDeliveryOptions([])
          setShippingSelections({})
        }
      })
      .catch(() => {
        setDeliveryOptions([])
        setShippingSelections({})
      })
      .finally(() => setDeliveryLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingCountryDraft])

  const handleShippingSelectionChange = (vendorId: number, slug: string) => {
    setShippingSelections((prev) => ({ ...prev, [String(vendorId)]: slug }))
  }

  // Total delivery price from all vendor selections
  const deliveryPrice = useMemo(() => {
    let total = 0
    for (const slug of Object.values(shippingSelections)) {
      const opt = deliveryOptions.find((o) => o.slug === slug)
      if (opt) total += parseFloat(opt.price ?? (checkoutCurrency === "GEL" ? opt.price_gel : opt.price_usd) ?? "0")
    }
    return total
  }, [shippingSelections, deliveryOptions, checkoutCurrency])

  function handleShippingNext(data: Record<string, string>, country: string) {
    const correctCurrency = country === "GE" ? "GEL" : "USD"

    if (correctCurrency !== currency) {
      setPendingShippingData(data)
      setPendingCountry(country)
      setShowGeoModal(true)
    } else {
      setCheckoutCurrency(correctCurrency)
      setShippingData(data)
      setStep("payment")
    }
  }

  async function handleGeoContinue() {
    const correctCurrency = pendingCountry === "GE" ? "GEL" : "USD"
    setGeoLoading(true)
    try {
      await repriceCart(correctCurrency)
      setCurrency(correctCurrency as "GEL" | "USD")
      setCheckoutCurrency(correctCurrency)
      setShippingData(pendingShippingData)
      setShowGeoModal(false)
      setStep("payment")
    } catch {
      setCurrency(correctCurrency as "GEL" | "USD")
      setCheckoutCurrency(correctCurrency)
      setShippingData(pendingShippingData)
      setShowGeoModal(false)
      setStep("payment")
    } finally {
      setGeoLoading(false)
    }
  }

  return (
    <SiteShell>
      {showGeoModal && (
        <GeoPricingModal
          country={pendingCountry}
          currency={pendingCountry === "GE" ? "GEL" : "USD"}
          loading={geoLoading}
          onContinue={() => { void handleGeoContinue() }}
        />
      )}
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-6">
          <h1 className="font-display text-4xl md:text-5xl text-dp-text-primary">Checkout</h1>
        </div>
      </div>

      <div className="dp-container py-8">
        {step === "confirmed" ? (
          <Confirmed orderNumber={confirmedOrder} orderId={confirmedOrderId} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-10 items-start">
            <div className="flex-1 min-w-0">
              <StepBar current={step} />
              {step === "shipping" && (
                <ShippingForm
                  onNext={handleShippingNext}
                  onCountryChange={setShippingCountryDraft}
                  deliveryOptions={deliveryOptions}
                  shippingSelections={shippingSelections}
                  onShippingSelectionChange={handleShippingSelectionChange}
                  deliveryLoading={deliveryLoading}
                  vendorGroups={vendorGroups}
                />
              )}
              {step === "payment" && <PaymentForm onNext={(data) => { setPaymentData(data); setStep("review") }} onBack={() => setStep("shipping")} />}
              {step === "review" && (
                <ReviewStep
                  shippingData={shippingData}
                  checkoutCurrency={checkoutCurrency}
                  paymentData={paymentData}
                  shippingSelections={shippingSelections}
                  deliveryOptions={deliveryOptions}
                  onConfirm={(num, id) => { setConfirmedOrder(num); setConfirmedOrderId(id); setStep("confirmed") }}
                  onBack={() => setStep("payment")}
                />
              )}
            </div>
            <OrderAside
              showShipping={deliveryOptions.length > 0}
              deliveryPrice={deliveryPrice}
            />
          </div>
        )}
      </div>
    </SiteShell>
  )
}
