"use client"

import React, { useState, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, CreditCard, CheckCircle, Lock, Truck, ArrowLeft, MapPin } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { authFetch, apiFetch } from "@/lib/api"
import { useRequireAuth } from "@/hooks/useRequireAuth"
import { useLocale } from "@/contexts/locale-context"
import { CartItemExtras } from "@/components/cart/CartItemExtras"

type DeliveryOpt = { id: number; slug: string; label: string; price_gel: string; price_usd: string; est_days_min: number; est_days_max: number }

type Step = "shipping" | "payment" | "review" | "confirmed"

// ─── Step indicator ───────────────────────────────────────
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

// ─── Field component ──────────────────────────────────────
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

// ─── Geo-pricing modal ────────────────────────────────────
function GeoPricingModal({ country, currency, onContinue }: { country: string; currency: string; onContinue: () => void }) {
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
              Your delivery address is in <strong className="text-dp-text-primary">{countryLabel}</strong>. All prices have been automatically updated to <strong className="text-dp-text-primary">{currencyLabel}</strong> to reflect the correct pricing for your region.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5">
          <button onClick={onContinue} className="w-full py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
            Continue with {currency} prices
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shipping form ────────────────────────────────────────
function ShippingForm({ onNext }: { onNext: (data: Record<string, string>, country: string) => void }) {
  const [f, setF] = useState({
    name: "", streetAddress: "", country: "US", state: "", zipCode: "",
    email: "", phone: "",
  })
  const set = (key: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [key]: v }))
  const valid = Object.values(f).every(Boolean)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onNext({
          shipping_name: f.name,
          shipping_line1: f.streetAddress,
          shipping_city: f.state,
          shipping_state: f.state,
          shipping_zip: f.zipCode,
          shipping_country: f.country,
          shipping_email: f.email,
          shipping_phone: f.phone,
        }, f.country)
      }}
      className="flex flex-col gap-4"
      aria-label="Shipping information"
    >
      <h2 className="font-display text-3xl text-dp-text-primary">Shipping Information</h2>

      {/* Full name */}
      <Field label="Full Name" id="name" autoComplete="name" placeholder="First and last name" value={f.name} onChange={set("name")} />

      {/* Street address */}
      <Field label="Street Address" id="streetAddress" autoComplete="street-address" placeholder="123 Main Street, Apt 4B" value={f.streetAddress} onChange={set("streetAddress")} />

      {/* Country + State */}
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
            {[
              ["GE","Georgia 🇬🇪"],
              ["US","United States"], ["GB","United Kingdom"], ["DE","Germany"],
              ["FR","France"], ["AU","Australia"], ["CA","Canada"],
              ["SK","Slovakia"], ["CZ","Czech Republic"], ["PL","Poland"],
              ["AT","Austria"], ["IT","Italy"], ["ES","Spain"],
            ].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <Field label="State / Region" id="state" autoComplete="address-level1" placeholder="e.g. New York" value={f.state} onChange={set("state")} />
      </div>

      {/* Zip code */}
      <Field label="ZIP / Postal Code" id="zipCode" autoComplete="postal-code" placeholder="e.g. 10001" value={f.zipCode} onChange={set("zipCode")} />

      {/* Email */}
      <Field label="Email Address" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={f.email} onChange={set("email")} />

      {/* Phone with hint */}
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

// ─── Payment form ─────────────────────────────────────────
function PaymentForm({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [f, setF] = useState({ cardNumber: "", name: "", expiry: "", cvc: "" })
  const set = (key: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [key]: v }))
  const valid = Object.values(f).every(Boolean)

  // Mask card number as groups of 4
  const handleCard = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16)
    const groups = digits.match(/.{1,4}/g) ?? []
    setF((p) => ({ ...p, cardNumber: groups.join(" ") }))
  }
  // Mask expiry as MM/YY
  const handleExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4)
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
    setF((p) => ({ ...p, expiry: formatted }))
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onNext() }}
      className="flex flex-col gap-4"
      aria-label="Payment information"
    >
      <h2 className="font-display text-3xl text-dp-text-primary">Payment</h2>

      {/* Secure badge */}
      <div className="flex items-center gap-2 text-[12px] text-dp-text-tertiary">
        <Lock size={13} className="text-dp-success" aria-hidden />
        <span>All transactions are encrypted and secure</span>
      </div>

      <div className="relative">
        <Field
          label="Card Number" id="cardNumber" type="text"
          autoComplete="cc-number" placeholder="1234 5678 9012 3456"
          value={f.cardNumber} onChange={handleCard}
        />
        <CreditCard
          size={16}
          className="absolute right-3 bottom-2.5 text-dp-text-tertiary"
          aria-hidden
        />
      </div>
      <Field label="Name on Card"   id="cardName"   autoComplete="cc-name"  placeholder="Full name as on card" value={f.name}   onChange={set("name")}   />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Expiry (MM/YY)" id="expiry" autoComplete="cc-exp"  placeholder="MM/YY" value={f.expiry} onChange={handleExpiry} />
        <Field label="CVC"             id="cvc"    autoComplete="cc-csc"  placeholder="123"   value={f.cvc}    onChange={set("cvc")}    />
      </div>

      {/* Accepted cards */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Accepted:</span>
        {["Visa","MC","Amex","PayPal"].map((c) => (
          <span
            key={c}
            className="px-2.5 py-0.5 border border-dp-border rounded-sm text-[10px] font-bold text-dp-text-tertiary uppercase tracking-widest"
          >
            {c}
          </span>
        ))}
      </div>

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-3 border border-dp-border rounded-sm text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
        >
          <ArrowLeft size={13} /> Back
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors"
        >
          Review Order <ChevronRight size={14} aria-hidden />
        </button>
      </div>
    </form>
  )
}

// ─── Review step ──────────────────────────────────────────
function ReviewStep({
  onConfirm, onBack, shippingData, checkoutCurrency, isGE,
}: {
  onConfirm: (orderNum: string) => void
  onBack: () => void
  shippingData: Record<string, string>
  checkoutCurrency: string
  isGE: boolean
}) {
  const { cart, refresh } = useCart()
  const { formatPrice } = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [deliveryType, setDeliveryType] = useState("standard")
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOpt[]>([])

  useEffect(() => {
    if (!isGE) return
    apiFetch<DeliveryOpt[]>("/orders/delivery-options/")
      .then((d) => { if (Array.isArray(d)) setDeliveryOptions(d) })
      .catch(() => {})
  }, [isGE])

  const items = cart?.items ?? []
  const subtotal = cart ? parseFloat(cart.subtotal) : 0
  const giftWrapTotal = items.reduce((sum, item) => sum + (item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0), 0)
  const selectedDelivery = deliveryOptions.find((o) => o.slug === deliveryType)
  const deliveryPrice = selectedDelivery
    ? parseFloat(checkoutCurrency === "GEL" ? selectedDelivery.price_gel : selectedDelivery.price_usd)
    : 0
  const total = subtotal + giftWrapTotal + deliveryPrice

  async function handlePlaceOrder() {
    setLoading(true)
    setError("")
    try {
      type OrderResponse = { id: string; order_number: string }
      const order = await authFetch<OrderResponse>("/orders/checkout/", {
        method: "POST",
        body: JSON.stringify({
          ...shippingData,
          currency: checkoutCurrency,
          delivery_type: deliveryType,
        }),
      })
      await authFetch("/orders/cart/", { method: "DELETE" }).catch(() => {})
      await refresh()
      onConfirm(order.order_number)
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setError(apiErr?.data?.detail ?? "Checkout failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

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
                {item.variant.size.label} · Qty {item.quantity}
              </p>
              <CartItemExtras item={item} formatPrice={formatPrice} compact />
            </div>
            <span className="text-[15px] font-bold text-dp-text-primary shrink-0">{formatPrice(parseFloat(item.line_total))}</span>
          </div>
        ))}

        <div className="px-4 py-3 flex flex-col gap-1.5 bg-dp-bg-elevated border-t border-dp-border">
          <div className="flex justify-between text-[13px]">
            <span className="text-dp-text-secondary">Subtotal</span>
            <span className="text-dp-text-primary font-semibold">{formatPrice(subtotal)}</span>
          </div>
          {giftWrapTotal > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-dp-text-secondary">Gift wrapping</span>
              <span className="text-dp-text-primary font-semibold">+{formatPrice(giftWrapTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px]">
            <span className="text-dp-text-secondary">Shipping</span>
            <span className="text-dp-text-primary font-semibold">
              {deliveryPrice === 0 ? "Free" : `+${formatPrice(deliveryPrice)}`}
            </span>
          </div>
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

      {/* Delivery selector — GE only */}
      {isGE && deliveryOptions.length > 0 && (
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">Delivery Method</p>
          <div className="flex flex-col gap-2">
            {deliveryOptions.map((opt) => {
              const optPrice = parseFloat(checkoutCurrency === "GEL" ? opt.price_gel : opt.price_usd)
              return (
                <label
                  key={opt.slug}
                  className={`flex items-center justify-between gap-3 px-4 py-3 border rounded-sm cursor-pointer transition-colors ${
                    deliveryType === opt.slug
                      ? "border-dp-accent-cta bg-dp-accent-cta/5"
                      : "border-dp-border hover:border-dp-border-hover"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="delivery"
                      value={opt.slug}
                      checked={deliveryType === opt.slug}
                      onChange={() => setDeliveryType(opt.slug)}
                      className="accent-dp-accent-cta"
                    />
                    <div>
                      <p className="text-[13px] font-semibold text-dp-text-primary">{opt.label}</p>
                      <p className="text-[11px] text-dp-text-tertiary">{opt.est_days_min}–{opt.est_days_max} business days</p>
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-dp-text-primary">
                    {optPrice === 0 ? "Free" : checkoutCurrency === "GEL" ? `₾${optPrice.toFixed(2)}` : `$${optPrice.toFixed(2)}`}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

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

// ─── Confirmation ─────────────────────────────────────────
function Confirmed({ orderNumber }: { orderNumber: string }) {
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
        <Link href="/account/orders" className="px-6 py-3 border border-dp-border rounded-sm text-[12px] font-bold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
          View Orders
        </Link>
        <Link href="/catalog" className="flex items-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
          Keep Shopping <ChevronRight size={13} aria-hidden />
        </Link>
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

// ─── Order aside ──────────────────────────────────────────
function OrderAside() {
  const { cart } = useCart()
  const { formatPrice } = useLocale()
  const items = cart?.items ?? []
  const subtotal = cart ? parseFloat(cart.subtotal) : 0
  const giftWrapTotal = items.reduce((sum, item) => sum + (item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0), 0)
  const total = subtotal + giftWrapTotal

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
                  {item.variant.size.label} · Qty {item.quantity}
                </p>
                <CartItemExtras item={item} formatPrice={formatPrice} compact />
              </div>
              <span className="text-[13px] font-bold text-dp-text-primary shrink-0">{formatPrice(parseFloat(item.line_total))}</span>
            </div>
          ))}
          <div className="border-t border-dp-border pt-3 flex flex-col gap-1.5">
            {giftWrapTotal > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-dp-text-tertiary">Gift wrapping</span>
                <span className="text-dp-text-primary">+{formatPrice(giftWrapTotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[13px] font-bold text-dp-text-primary">Total</span>
              <span className="font-display text-xl text-dp-text-primary">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────
export default function CheckoutPage(): React.ReactElement {
  useRequireAuth()
  const { cart } = useCart()
  const { setCurrency, currency } = useLocale()
  const [step, setStep] = useState<Step>("shipping")
  const [shippingData, setShippingData] = useState<Record<string, string>>({})
  const [confirmedOrder, setConfirmedOrder] = useState("")
  const [showGeoModal, setShowGeoModal] = useState(false)
  const [pendingShippingData, setPendingShippingData] = useState<Record<string, string>>({})
  const [pendingCountry, setPendingCountry] = useState("")
  const [checkoutCurrency, setCheckoutCurrency] = useState("USD")
  const [isGE, setIsGE] = useState(false)

  function handleShippingNext(data: Record<string, string>, country: string) {
    // Determine the correct currency for the chosen shipping country
    const correctCurrency = country === "GE" ? "GEL" : "USD"
    const isGEAddress = country === "GE"

    if (correctCurrency !== currency) {
      // Currency mismatch — show modal and auto-apply correct currency
      setPendingShippingData(data)
      setPendingCountry(country)
      setShowGeoModal(true)
    } else {
      setIsGE(isGEAddress)
      setCheckoutCurrency(correctCurrency)
      setShippingData(data)
      setStep("payment")
    }
  }

  function handleGeoContinue() {
    const correctCurrency = pendingCountry === "GE" ? "GEL" : "USD"
    const isGEAddress = pendingCountry === "GE"
    setCurrency(correctCurrency as "GEL" | "USD")
    setCheckoutCurrency(correctCurrency)
    setIsGE(isGEAddress)
    setShippingData(pendingShippingData)
    setShowGeoModal(false)
    setStep("payment")
  }

  return (
    <SiteShell>
      {showGeoModal && (
        <GeoPricingModal
          country={pendingCountry}
          currency={pendingCountry === "GE" ? "GEL" : "USD"}
          onContinue={handleGeoContinue}
        />
      )}
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-6">
          <h1 className="font-display text-4xl md:text-5xl text-dp-text-primary">Checkout</h1>
        </div>
      </div>

      <div className="dp-container py-8">
        {step === "confirmed" ? (
          <Confirmed orderNumber={confirmedOrder} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-10 items-start">
            <div className="flex-1 min-w-0">
              <StepBar current={step} />
              {step === "shipping" && <ShippingForm onNext={handleShippingNext} />}
              {step === "payment"  && <PaymentForm  onNext={() => setStep("review")}  onBack={() => setStep("shipping")} />}
              {step === "review"   && (
                <ReviewStep
                  shippingData={shippingData}
                  checkoutCurrency={checkoutCurrency}
                  isGE={isGE}
                  onConfirm={(num) => { setConfirmedOrder(num); setStep("confirmed") }}
                  onBack={() => setStep("payment")}
                />
              )}
            </div>
            <OrderAside />
          </div>
        )}
      </div>
    </SiteShell>
  )
}
