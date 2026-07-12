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
  if (currency === "GEL") {
    const gelSale = toNum(sv.sale_price_gel)
    if (gelSale != null) return gelSale
  }
  const saleUsd = toNum(sv.sale_price_usd)
  if (saleUsd == null) return null
  return currency === "USD" ? saleUsd : saleUsd * (rates[currency] ?? 1)
}

function variantHasExplicitSale(sv: SizeVariantPrice): boolean {
  return toNum(sv.sale_price_usd) != null || toNum(sv.sale_price_gel) != null
}

export function resolveSizeVariantPrice(
  sv: SizeVariantPrice,
  currency: Currency,
  rates: Record<Currency, number>,
  isSale = false,
  productSale?: { base_price?: string | number; original_price?: string | number | null } | null,
): { price: number; original: number | null } {
  const regular = regionalPriceForCurrency(sv, currency)
  const regularFallback = regular ?? (toNum(sv.price_usd) ?? 0) * (rates[currency] ?? 1)

  const onSale = isSale || variantHasExplicitSale(sv)
  if (!onSale) {
    return { price: regularFallback, original: null }
  }

  let sale = resolveVariantExplicitSale(sv, currency, rates)
  if (sale == null && isSale && productSale) {
    const base = toNum(productSale.base_price)
    const orig = toNum(productSale.original_price)
    if (base != null && orig != null && orig > base && orig > 0) {
      sale = regularFallback * (base / orig)
    }
  }

  if (sale != null && sale < regularFallback) {
    return { price: sale, original: regularFallback }
  }

  return { price: regularFallback, original: null }
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
    const resolved = activeVariants.map((sv) =>
      resolveSizeVariantPrice(sv, currency, rates, Boolean(product.is_sale), product),
    )
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
