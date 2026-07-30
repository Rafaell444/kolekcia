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

/**
 * Explicit sale for the active market only — never cross-convert currencies.
 */
function resolveVariantExplicitSale(sv: SizeVariantPrice, currency: Currency): number | null {
  if (currency === "GEL") return toNum(sv.sale_price_gel)
  if (currency === "USD") return toNum(sv.sale_price_usd)
  return null
}

/**
 * Resolve size-variant price for a market.
 * Uses admin-written regional prices only — NO FX conversion.
 * If a regional price is missing, falls back to price_usd as-is (admin should set GEL/EUR/GBP).
 */
export function resolveSizeVariantPrice(
  sv: SizeVariantPrice,
  currency: Currency,
  _rates?: Record<Currency, number>,
): { price: number; original: number | null } {
  const regional = regionalPriceForCurrency(sv, currency)
  const usd = toNum(sv.price_usd) ?? 0
  const regularPrice = regional ?? usd

  const salePrice = resolveVariantExplicitSale(sv, currency)

  if (salePrice != null && salePrice < regularPrice) {
    return { price: salePrice, original: regularPrice }
  }

  return { price: regularPrice, original: null }
}

/**
 * Product-level regional prices — no FX.
 */
export function resolveProductPrices(
  basePrice: string | number,
  originalPrice: string | number | null | undefined,
  regionalPrices: RegionalPrices | null | undefined,
  currency: Currency,
  _rates?: Record<Currency, number>,
): { price: number; original: number | null } {
  const regional = regionalPrices?.[currency]
  const regionalPrice = toNum(regional?.price)
  if (regionalPrice != null) {
    return {
      price: regionalPrice,
      original: toNum(regional?.original),
    }
  }

  // No regional override — use base as-is (base is USD in admin)
  const base = toNum(basePrice) ?? 0
  const orig = toNum(originalPrice)
  return {
    price: base,
    original: orig,
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
  rates?: Record<Currency, number>,
): { price: number; original: number | null } {
  const activeVariants = (product.size_variants ?? []).filter((sv) => sv.is_active !== false)
  if (activeVariants.length > 0) {
    const resolved = activeVariants.map((sv) => resolveSizeVariantPrice(sv, currency, rates))
    const cheapest = resolved.reduce((best, current) => (current.price < best.price ? current : best))
    return cheapest
  }
  return resolveProductPrices(
    product.base_price,
    product.original_price ?? null,
    product.regional_prices ?? {},
    currency,
    rates,
  )
}

/** Format an amount already in the given market currency — never converts. */
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
