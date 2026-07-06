"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type Language = "en" | "ka" | "ru"
export type Currency = "USD" | "GEL" | "EUR" | "GBP"

export type LanguageMeta = {
  code: Language
  label: string
  nativeLabel: string
  flag: string
}

export type CurrencyMeta = {
  code: Currency
  symbol: string
  label: string
  flag: string
}

// ─── Static data ──────────────────────────────────────────────────────────────

export const LANGUAGES: LanguageMeta[] = [
  { code: "en", label: "English",  nativeLabel: "English",   flag: "🇬🇧" },
  { code: "ka", label: "Georgian", nativeLabel: "ქართული",  flag: "🇬🇪" },
  { code: "ru", label: "Russian",  nativeLabel: "Русский",   flag: "🇷🇺" },
]

export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", symbol: "$",  label: "US Dollar",       flag: "🇺🇸" },
  { code: "GEL", symbol: "₾",  label: "Georgian Lari",   flag: "🇬🇪" },
  { code: "EUR", symbol: "€",  label: "Euro",            flag: "🇪🇺" },
  { code: "GBP", symbol: "£",  label: "British Pound",   flag: "🇬🇧" },
]

// ─── Exchange rates ───────────────────────────────────────────────────────────
//
// Fallback static rates (USD base). These are used when no live API is
// configured or when the fetch fails.
//
// TO ADD LIVE RATES: Set NEXT_PUBLIC_EXCHANGE_RATES_URL in your .env to any
// API that returns JSON like: { "rates": { "GEL": 2.65, "EUR": 0.92, "GBP": 0.79 } }
// Examples: exchangerate-api.com, fixer.io, openexchangerates.org, frankfurter.app
//
const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  GEL: 2.65,
  EUR: 0.92,
  GBP: 0.79,
}

const RATES_CACHE_KEY = "kolekcia_rates"
const RATES_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

async function fetchLiveRates(): Promise<Record<Currency, number>> {
  const url = process.env.NEXT_PUBLIC_EXCHANGE_RATES_URL
  if (!url) return FALLBACK_RATES

  try {
    // Check cache first
    const cached = localStorage.getItem(RATES_CACHE_KEY)
    if (cached) {
      const { rates, ts } = JSON.parse(cached) as { rates: Record<Currency, number>; ts: number }
      if (Date.now() - ts < RATES_CACHE_TTL) return { ...FALLBACK_RATES, ...rates }
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error("fetch failed")
    const data = await res.json()
    // Support common shapes: { rates: {...} } or { conversion_rates: {...} } or flat object
    const raw: Record<string, number> = data.rates ?? data.conversion_rates ?? data
    const rates: Partial<Record<Currency, number>> = {}
    for (const key of ["GEL", "EUR", "GBP"] as Currency[]) {
      if (raw[key]) rates[key] = raw[key]
    }
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }))
    return { ...FALLBACK_RATES, ...rates }
  } catch {
    return FALLBACK_RATES
  }
}

// ─── Geo-detection helpers ────────────────────────────────────────────────────

/** EU country codes → EUR */
const EU_COUNTRIES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI",
  "FR","GR","HR","HU","IE","IT","LT","LU","LV","MT",
  "NL","PL","PT","RO","SE","SI","SK",
])

/** Russian-speaking countries → Russian + keep local currency */
const RU_COUNTRIES = new Set(["RU","BY","KZ","AM","AZ","KG","TJ","TM","UZ","MD"])

function detectLanguage(countryCode: string, browserLang: string): Language {
  if (countryCode === "GE") return "ka"
  if (RU_COUNTRIES.has(countryCode)) return "ru"
  if (browserLang.startsWith("ka")) return "ka"
  if (browserLang.startsWith("ru")) return "ru"
  return "en"
}

function detectCurrency(countryCode: string, apiCurrency?: string): Currency {
  if (countryCode === "GE") return "GEL"
  if (countryCode === "GB") return "GBP"
  if (EU_COUNTRIES.has(countryCode)) return "EUR"
  // Trust the API-reported currency if it's one we support
  if (apiCurrency && apiCurrency in FALLBACK_RATES) return apiCurrency as Currency
  return "USD"
}

// ─── Context ──────────────────────────────────────────────────────────────────

type LocaleContextValue = {
  language: Language
  currency: Currency
  detectedCountry: string | null
  /** Live exchange rates keyed by currency code (USD base = 1) */
  rates: Record<Currency, number>
  setLanguage: (lang: Language) => void
  setCurrency: (cur: Currency) => void
  /** Format a USD amount in the currently selected currency */
  formatPrice: (usdAmount: number | string | null | undefined) => string
  currentLang: LanguageMeta
  currentCur: CurrencyMeta
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider")
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const LS_LANG_KEY = "kolekcia_lang"
const LS_CUR_KEY  = "kolekcia_currency"

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<Language>("en")
  const [currency, setCurState] = useState<Currency>("USD")
  const [rates, setRates] = useState<Record<Currency, number>>(FALLBACK_RATES)
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // On mount: restore saved language pref, always geo-detect currency from IP
  useEffect(() => {
    const savedLang = localStorage.getItem(LS_LANG_KEY) as Language | null

    if (savedLang && LANGUAGES.some((l) => l.code === savedLang)) {
      setLangState(savedLang)
    }

    // Fetch live rates (uses cache if fresh, falls back to static if no URL set)
    fetchLiveRates().then(setRates)

    // Always geo-detect currency — users cannot override it manually
    const browserLang = navigator.language ?? "en"
    detectFromIp(browserLang, savedLang !== null)

    setHydrated(true)
  }, [])

  // skipLang = true when user has already saved a language preference
  async function detectFromIp(browserLang: string, skipLang = false) {
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error("geo failed")
      const data = await res.json()
      const cc: string = (data.country_code ?? "").toUpperCase()
      const apiCur: string = (data.currency ?? "").toUpperCase()
      setDetectedCountry(cc)
      if (!skipLang) {
        const lang = detectLanguage(cc, browserLang)
        setLangState(lang)
      }
      const cur = detectCurrency(cc, apiCur)
      setCurState(cur)
    } catch {
      if (!skipLang) {
        const bl = navigator.language ?? "en"
        if (bl.startsWith("ka")) setLangState("ka")
        else if (bl.startsWith("ru")) setLangState("ru")
      }
    }
  }

  const setLanguage = useCallback((lang: Language) => {
    setLangState(lang)
    localStorage.setItem(LS_LANG_KEY, lang)
  }, [])

  // Currency is set programmatically (e.g. forced by checkout shipping country).
  // It is intentionally NOT saved to localStorage so the next session re-geo-detects.
  const setCurrency = useCallback((cur: Currency) => {
    setCurState(cur)
  }, [])

  const formatPrice = useCallback(
    (usdAmount: number | string | null | undefined): string => {
      const num = typeof usdAmount === "string" ? parseFloat(usdAmount) : (usdAmount ?? 0)
      if (isNaN(num)) return ""
      const converted = num * (rates[currency] ?? 1)
      const cur = CURRENCIES.find((c) => c.code === currency)!
      const formatted = converted.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      // GEL uses suffix symbol (₾), others use prefix
      if (currency === "GEL") return `${formatted} ${cur.symbol}`
      return `${cur.symbol}${formatted}`
    },
    [currency, rates]
  )

  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]
  const currentCur  = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]

  if (!hydrated) {
    // Render children immediately — avoid layout shift.
    // Context values use defaults until hydration completes.
  }

  return (
    <LocaleContext.Provider
      value={{ language, currency, detectedCountry, rates, setLanguage, setCurrency, formatPrice, currentLang, currentCur }}
    >
      {children}
    </LocaleContext.Provider>
  )
}
