"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import LocalizedLink from "@/components/seo/LocalizedLink"
import { ChevronRight, CheckCircle, Lock, Truck, ArrowLeft, MapPin, Package } from "lucide-react"
import { useCart, type CartType } from "@/contexts/cart-context"
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

type Step = "shipping" | "payment" | "confirmed"
const CHECKOUT_HANDOFF_KEY = "kolekcia_checkout_handoff"
type CheckoutHandoff = {
  savedAt: number
  cart: CartType
  shippingData: Record<string, string>
  shippingSelections: Record<string, string>
  deliveryOptions: DeliveryOpt[]
  shippingCountry: string
  checkoutCurrency: string
  idempotencyKey: string
  paymentUrl: string
}
type Address = { id: number; label: string; line1: string; line2: string; city: string; state: string; zip_code: string; country: string; is_default: boolean }
type ShippingFormValues = {
  addressLabel: string
  name: string
  streetAddress: string
  country: string
  state: string
  zipCode: string
  email: string
  phone: string
}

function shippingDataToFormValues(data: Record<string, string>, fallbackEmail = ""): ShippingFormValues {
  return {
    addressLabel: data.address_label ?? "",
    name: data.shipping_name ?? "",
    streetAddress: data.shipping_line1 ?? "",
    country: data.shipping_country ?? "US",
    state: data.shipping_state ?? data.shipping_city ?? "",
    zipCode: data.shipping_zip ?? "",
    email: data.shipping_email ?? fallbackEmail,
    phone: data.shipping_phone ?? "",
  }
}

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
  shippingSelections, onShippingSelectionChange,
  deliveryLoading, vendorGroups, initialData,
}: {
  onNext: (data: Record<string, string>, country: string) => void
  onCountryChange: (country: string) => void
  shippingSelections: Record<string, string>
  onShippingSelectionChange: (vendorId: number, slug: string) => void
  deliveryLoading: boolean
  vendorGroups: VendorGroup[]
  initialData: Record<string, string>
}) {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new">("new")
  const [f, setF] = useState<ShippingFormValues>(() => shippingDataToFormValues(initialData, user?.email ?? ""))
  const hasInitialData = Boolean(initialData.shipping_line1 || initialData.shipping_country)
  const set = (key: keyof typeof f) => (v: string) => {
    setF((p) => ({ ...p, [key]: v }))
    if (key === "country") onCountryChange(v)
  }
  const shippingCurrency = f.country === "GE" ? "GEL" : "USD"

  const applyAddress = useCallback((addr: Address) => {
    setSelectedAddressId(addr.id)
    setF((prev) => ({
      ...prev,
      addressLabel: addr.label,
      streetAddress: addr.line1,
      country: addr.country,
      state: addr.state || addr.city,
      zipCode: addr.zip_code,
    }))
    onCountryChange(addr.country)
  }, [onCountryChange])

  const startNewAddress = useCallback(() => {
    setSelectedAddressId("new")
    setF({
      addressLabel: "",
      name: "",
      streetAddress: "",
      country: "",
      state: "",
      zipCode: "",
      email: user?.email ?? "",
      phone: "",
    })
    onCountryChange("")
  }, [onCountryChange, user?.email])

  useEffect(() => {
    let cancelled = false
    authFetch<Address[]>("/auth/addresses/")
      .then((d) => {
        if (cancelled) return
        const list = Array.isArray(d) ? d : (d as { results?: Address[] }).results ?? []
        setAddresses(list)
        if (hasInitialData) return
        const def = list.find((addr) => addr.is_default) ?? list[0]
        if (def) applyAddress(def)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [applyAddress, hasInitialData])

  async function saveCheckoutAddress() {
    if (selectedAddressId !== "new") return
    await authFetch("/auth/addresses/", {
      method: "POST",
      body: JSON.stringify({
        label: f.addressLabel.trim(),
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
            <input type="radio" className="accent-dp-accent-cta" checked={selectedAddressId === "new"} onChange={startNewAddress} />
            <span className="text-[13px] font-semibold text-dp-text-primary">Add a new address</span>
          </label>
        </div>
      )}

      <Field label="Address Name" id="addressLabel" autoComplete="off" placeholder="e.g. Home, Office" value={f.addressLabel} onChange={set("addressLabel")} />
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
            <option value="" disabled>Select a country</option>
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

function ReviewStep({
  onConfirm, onBack, shippingData, checkoutCurrency,
  shippingSelections, deliveryOptions, cartSnapshot, checkoutIdempotencyKey, onPaymentHandoff,
}: {
  onConfirm: (orderNum: string, orderId: string) => void
  onBack: () => void
  shippingData: Record<string, string>
  checkoutCurrency: string
  shippingSelections: Record<string, string>
  deliveryOptions: DeliveryOpt[]
  cartSnapshot?: CartType | null
  checkoutIdempotencyKey: string
  onPaymentHandoff: (cart: CartType, paymentUrl: string) => void
}) {
  const { cart } = useCart()
  const displayCart = (cart?.items.length ? cart : cartSnapshot) ?? null
  const { formatPrice } = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const items = displayCart?.items ?? []
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

  const discount = parseFloat(displayCart?.discount || "0")
  const total = Math.max(0, productsTotal + giftWrapTotal + processingTotal - discount + deliveryPrice)

  const hasVendorShippingSelection = Object.keys(shippingSelections).length > 0

  async function handlePlaceOrder() {
    setLoading(true)
    setError("")
    try {
      type OrderResponse = { id: string; order_number: string }
      type PaymentResponse = {
        payment_required: true
        payment_url: string
        order: OrderResponse
      }
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

      const result = await authFetch<OrderResponse | PaymentResponse>("/orders/checkout/", {
        method: "POST",
        headers: { "Idempotency-Key": checkoutIdempotencyKey },
        body: JSON.stringify(checkoutBody),
      })
      if ("payment_required" in result && result.payment_required) {
        if (displayCart) onPaymentHandoff(displayCart, result.payment_url)
        const locale = window.location.pathname.split("/").filter(Boolean)[0] || "en"
        window.location.replace(`/${locale}/payment-handoff`)
        return
      }
      const order = result as OrderResponse
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
    <div className="flex flex-col gap-5" aria-label="Secure payment handoff">
      <h2 className="font-display text-3xl text-dp-text-primary">Secure Payment</h2>
      <div className="flex items-start gap-3 rounded-sm border border-dp-border bg-dp-bg-elevated px-4 py-3">
        <Lock size={16} className="mt-0.5 text-dp-success shrink-0" aria-hidden />
        <p className="text-[13px] text-dp-text-secondary leading-relaxed">
          Review your shipping and order total below. When you continue, you will be redirected to our secure payment page where you can choose an available payment method.
        </p>
      </div>
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
                  {discountLabel(displayCart)}
                  {displayCart?.promo_products_only && displayCart.applied_discount_source === "voucher" ? " · products" : ""}
                </span>
                <span className="font-semibold">−{formatPrice(discount)}</span>
              </div>
              {displayCart?.discount_message && (
                <p className="text-[11px] text-dp-text-tertiary leading-relaxed">{displayCart.discount_message}</p>
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
          disabled={loading || !checkoutIdempotencyKey || items.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors"
        >
          {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock size={14} />}
          {loading ? "Opening secure payment..." : "Continue to Payment"}
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
  cartSnapshot = null,
}: {
  deliveryPrice?: number
  showShipping?: boolean
  cartSnapshot?: CartType | null
}) {
  const { cart } = useCart()
  const displayCart = (cart?.items.length ? cart : cartSnapshot) ?? null
  const { formatPrice } = useLocale()
  const items = displayCart?.items ?? []
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
  const discount = parseFloat(displayCart?.discount || "0")
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
                    {discountLabel(displayCart)}
                    {displayCart?.promo_products_only && displayCart.applied_discount_source === "voucher" ? " · products" : ""}
                  </span>
                  <span>−{formatPrice(discount)}</span>
                </div>
              {displayCart?.discount_message && (
                <p className="text-[11px] text-dp-text-tertiary leading-relaxed">{displayCart.discount_message}</p>
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
  const [cartSnapshot, setCartSnapshot] = useState<CartType | null>(null)
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState("")

  // Per-vendor shipping
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({})
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOpt[]>([])
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [shippingCountryDraft, setShippingCountryDraft] = useState("US")

  useEffect(() => {
    const newKey = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setCheckoutIdempotencyKey(newKey)
  }, [])

  const vendorGroups = useMemo(() => groupOptionsByVendor(deliveryOptions), [deliveryOptions])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function handlePaymentHandoff(cartForDisplay: CartType, paymentUrl: string) {
    const snapshot: CheckoutHandoff = {
      savedAt: Date.now(),
      cart: cartForDisplay,
      shippingData,
      shippingSelections,
      deliveryOptions,
      shippingCountry: shippingData.shipping_country || shippingCountryDraft,
      checkoutCurrency,
      idempotencyKey: checkoutIdempotencyKey,
      paymentUrl,
    }
    setCartSnapshot(cartForDisplay)
    sessionStorage.setItem(CHECKOUT_HANDOFF_KEY, JSON.stringify(snapshot))
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
                  shippingSelections={shippingSelections}
                  onShippingSelectionChange={handleShippingSelectionChange}
                  deliveryLoading={deliveryLoading}
                  vendorGroups={vendorGroups}
                  initialData={shippingData}
                />
              )}
              {step === "payment" && (
                <ReviewStep
                  shippingData={shippingData}
                  checkoutCurrency={checkoutCurrency}
                  shippingSelections={shippingSelections}
                  deliveryOptions={deliveryOptions}
                  cartSnapshot={cartSnapshot}
                  checkoutIdempotencyKey={checkoutIdempotencyKey}
                  onPaymentHandoff={handlePaymentHandoff}
                  onConfirm={(num, id) => { sessionStorage.removeItem(CHECKOUT_HANDOFF_KEY); setConfirmedOrder(num); setConfirmedOrderId(id); setStep("confirmed") }}
                  onBack={() => setStep("shipping")}
                />
              )}
            </div>
            <OrderAside
              showShipping={deliveryOptions.length > 0}
              deliveryPrice={deliveryPrice}
              cartSnapshot={cartSnapshot}
            />
          </div>
        )}
      </div>
    </SiteShell>
  )
}
