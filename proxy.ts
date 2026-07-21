import { NextRequest, NextResponse } from "next/server"
import { LOCALES, DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n"

const PUBLIC_FILE = /\.(.*)$/
const SKIP_PREFIXES = ["/_next", "/api", "/admin", "/static", "/media", "/favicon"]

function shouldSkip(pathname: string): boolean {
  if (PUBLIC_FILE.test(pathname)) return true
  return SKIP_PREFIXES.some((p) => pathname.startsWith(p))
}

/** Map country codes to locales */
function localeFromCountry(countryCode: string | null): string | null {
  if (!countryCode) return null
  const cc = countryCode.toUpperCase()
  if (cc === "GE") return "ka"
  if (["RU", "BY", "KZ", "KG", "TJ", "UZ", "AZ", "AM", "MD", "UA"].includes(cc)) return "ru"
  return null
}

/** Get country code from various geo headers (Nginx, CloudFront, Cloudflare, Vercel) */
function getGeoCountry(request: NextRequest): string | null {
  // DEBUG: Allow ?geo=XX query param for testing (e.g., ?geo=GE, ?geo=US)
  const geoOverride = request.nextUrl.searchParams.get("geo")
  if (geoOverride && /^[A-Z]{2}$/i.test(geoOverride)) {
    return geoOverride.toUpperCase()
  }

  // Nginx GeoIP module
  const nginxCountry = request.headers.get("x-country-code")
  if (nginxCountry) return nginxCountry

  // AWS CloudFront
  const cfCountry = request.headers.get("cloudfront-viewer-country")
  if (cfCountry) return cfCountry

  // Cloudflare
  const cloudflareCountry = request.headers.get("cf-ipcountry")
  if (cloudflareCountry) return cloudflareCountry

  // Vercel
  const vercelCountry = request.headers.get("x-vercel-ip-country")
  if (vercelCountry) return vercelCountry

  return null
}

function detectLocale(request: NextRequest): string {
  // 1. Saved preference cookie (user explicitly chose a language)
  const cookie = request.cookies.get("NEXT_LOCALE")?.value
  if (cookie && isValidLocale(cookie)) return cookie

  // 2. Geo-based locale from reverse proxy headers (Nginx, CloudFront, Cloudflare, Vercel)
  const geoCountry = getGeoCountry(request)
  const geoLocale = localeFromCountry(geoCountry)
  if (geoLocale && isValidLocale(geoLocale)) return geoLocale

  // 3. Accept-Language header (browser preference) - fallback if no geo headers
  const accept = request.headers.get("accept-language") ?? ""
  for (const part of accept.split(",")) {
    const lang = part.split(";")[0].trim().substring(0, 2).toLowerCase()
    if (isValidLocale(lang)) return lang
  }

  return DEFAULT_LOCALE
}

/**
 * Next.js 16 proxy (replaces middleware.ts).
 * - Locale prefix routing (/en, /ka, /ru)
 * - Legacy /catalog/{category}/{slug} → /catalog/{slug}
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Legacy category+slug product URLs (with or without locale prefix)
  const categoryProductMatch = pathname.match(
    /^\/(?:(en|ka|ru)\/)?catalog\/([^/]+)\/([^/]+)\/?$/,
  )
  if (categoryProductMatch) {
    const locale = categoryProductMatch[1]
    const slug = categoryProductMatch[3]
    const url = request.nextUrl.clone()
    url.pathname = locale ? `/${locale}/catalog/${slug}` : `/catalog/${slug}`
    return NextResponse.redirect(url, 308)
  }

  if (shouldSkip(pathname)) return NextResponse.next()

  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0] ?? ""

  if (isValidLocale(firstSegment)) {
    const response = NextResponse.next()
    response.headers.set("x-locale", firstSegment)
    return response
  }

  const locale = detectLocale(request)
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname}`
  const response = NextResponse.redirect(url)
  response.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 365 * 24 * 60 * 60 })
  
  // Pass detected country to client for currency detection
  const geoCountry = getGeoCountry(request)
  if (geoCountry) {
    response.cookies.set("GEO_COUNTRY", geoCountry.toUpperCase(), { path: "/", maxAge: 24 * 60 * 60 })
  }
  
  return response
}

export const config = {
  matcher: ["/((?!_next|api|admin|static|media|favicon|robots|sitemap).*)"],
}
