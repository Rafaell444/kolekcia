import type { Currency } from "@/contexts/locale-context"
import { CURRENCIES } from "@/contexts/locale-context"

export type RegionalPriceEntry = { price?: string | number | null; original?: string | number | null }
export type RegionalPrices = Partial<Record<Currency, RegionalPriceEntry>>

export type SizeVariantPrice = {
  price_usd: string | number
  price_gel?: string | number | null
  price_eur?: string | number | null
  price_gbp?: string | number | null
  sale_price_usd?: string | number | null
  sale_price_gel?: string | number | null
  is_active?: boolean
}

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "string" ? parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

function regionalPriceForCurrency(sv: SizeVariantPrice, currency: Currency): number | null {
  if (currency === "GEL") return toNum(sv.price_gel)
  if (currency === "EUR") return toNum(sv.price_eur)
  if (currency === "GBP") return toNum(sv.price_gbp)
  return toNum(sv.price_usd)
}

function resolveVariantExplicitSale(
  sv: SizeVariantPrice,
  currency: Currency,
  rates: Record<Currency, number>,
): number | null {
  const saleGel = toNum(sv.sale_price_gel)
  const saleUsd = toNum(sv.sale_price_usd)
  const gelRate = rates.GEL || 1

  // GEL market: use the GEL sale as entered — never convert USD→GEL
  if (currency === "GEL") {
    return saleGel
  }

  // USD (and other): prefer USD sale; only convert GEL→USD when USD sale is missing
  if (saleUsd != null) {
    return currency === "USD" ? saleUsd : saleUsd * (rates[currency] ?? 1)
  }
  if (saleGel != null && gelRate > 0) {
    const asUsd = saleGel / gelRate
    return currency === "USD" ? asUsd : asUsd * (rates[currency] ?? 1)
  }
  return null
}

export function resolveSizeVariantPrice(
  sv: SizeVariantPrice,
  currency: Currency,
  rates: Record<Currency, number>,
): { price: number; original: number | null } {
  // Get the direct regional price (GEL, EUR, GBP) if set
  const regional = regionalPriceForCurrency(sv, currency)
  // Only fall back to USD conversion if no regional price exists
  const regularPrice = regional ?? (toNum(sv.price_usd) ?? 0) * (rates[currency] ?? 1)

  // Check for explicit sale price on this variant
  const salePrice = resolveVariantExplicitSale(sv, currency, rates)
  
  // Only show sale if variant has explicit sale price AND it's lower than regular
  if (salePrice != null && salePrice < regularPrice) {
    return { price: salePrice, original: regularPrice }
  }

  // No sale - just return regular price
  return { price: regularPrice, original: null }
}

export function resolveProductPrices(
  basePrice: string | number,
  originalPrice: string | number | null | undefined,
  regionalPrices: RegionalPrices | null | undefined,
  currency: Currency,
  rates: Record<Currency, number>,
): { price: number; original: number | null } {
  const regional = regionalPrices?.[currency]
  const regionalPrice = toNum(regional?.price)
  if (regionalPrice != null) {
    return {
      price: regionalPrice,
      original: toNum(regional?.original),
    }
  }

  const base = toNum(basePrice) ?? 0
  const rate = rates[currency] ?? 1
  const orig = toNum(originalPrice)
  return {
    price: base * rate,
    original: orig != null ? orig * rate : null,
  }
}

export function resolveListProductPrice(
  product: {
    base_price: string | number
    original_price?: string | number | null
    regional_prices?: RegionalPrices | null
    is_sale?: boolean
    size_variants?: SizeVariantPrice[]
  },
  currency: Currency,
  rates: Record<Currency, number>,
): { price: number; original: number | null } {
  const activeVariants = (product.size_variants ?? []).filter((sv) => sv.is_active !== false)
  if (activeVariants.length > 0) {
    // Resolve each variant's price using its own regional/sale prices
    const resolved = activeVariants.map((sv) => resolveSizeVariantPrice(sv, currency, rates))
    // Return the cheapest variant (for "from X" display)
    const cheapest = resolved.reduce((best, current) => (current.price < best.price ? current : best))
    return cheapest
  }
  // No size variants - use product-level pricing
  return resolveProductPrices(
    product.base_price,
    product.original_price ?? null,
    product.regional_prices ?? {},
    currency,
    rates,
  )
}

export function formatAmount(amount: number | string | null | undefined, currency: Currency): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0)
  if (!Number.isFinite(num)) return ""
  const cur = CURRENCIES.find((c) => c.code === currency)!
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (currency === "GEL") return `${formatted} ${cur.symbol}`
  return `${cur.symbol}${formatted}`
}
