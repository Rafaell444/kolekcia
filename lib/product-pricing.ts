import type { Currency } from "@/contexts/locale-context"
import { CURRENCIES } from "@/contexts/locale-context"

export type RegionalPriceEntry = { price?: string | number | null; original?: string | number | null }
export type RegionalPrices = Partial<Record<Currency, RegionalPriceEntry>>

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "string" ? parseFloat(v) : v
  return Number.isFinite(n) ? n : null
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
