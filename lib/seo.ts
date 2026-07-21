import type { Metadata } from "next"
import { LOCALES, DEFAULT_LOCALE } from "./i18n"

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://koleqcia.com"

/** Default Open Graph / Twitter share image (local brand asset). */
export const DEFAULT_OG_IMAGE = "/images/og-koleqcia.jpg"

/** Ensure path starts with a single leading slash and has no trailing slash (except root). */
function normalizePath(path: string): string {
  if (!path || path === "/") return ""
  const withSlash = path.startsWith("/") ? path : `/${path}`
  return withSlash.replace(/\/+$/, "")
}

/** Resolve a relative path or absolute URL to a full absolute URL. */
export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return SITE_URL
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`
  return `${SITE_URL}${path}`
}

/**
 * Strip a trailing " | Koleqcia" so the root layout title template
 * (`%s | Koleqcia`) does not duplicate the brand.
 */
export function stripBrandTitleSuffix(title: string): string {
  return title.replace(/\s*\|\s*Koleqcia\s*$/i, "").trim()
}

/**
 * Build canonical + hreflang language alternates for a locale-prefixed path.
 * `path` should be the path without locale (e.g. `/catalog`, `/blog/my-post`).
 * `x-default` points to the English version.
 */
export function buildAlternates(path: string, locale: string) {
  const normalized = normalizePath(path)
  const languages: Record<string, string> = {}
  for (const loc of LOCALES) {
    languages[loc] = `${SITE_URL}/${loc}${normalized}`
  }
  languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${normalized}`

  return {
    canonical: `${SITE_URL}/${locale}${normalized}`,
    languages,
  }
}

export function buildTwitter(
  title: string,
  description: string,
  image?: string | null,
): NonNullable<Metadata["twitter"]> {
  const img = image || DEFAULT_OG_IMAGE
  return {
    card: "summary_large_image",
    title,
    description,
    images: [img],
  }
}

type BuildPageMetadataOpts = {
  title: string
  description?: string
  path: string
  locale: string
  image?: string | null
  openGraphType?: "website" | "article"
  keywords?: string
  robots?: Metadata["robots"]
  /** If true, return title as absolute (skip layout `%s | Koleqcia` template). */
  absoluteTitle?: boolean
}

/** Shared metadata shape for locale pages (canonical, hreflang, OG url/image, Twitter). */
export function buildPageMetadata({
  title,
  description = "",
  path,
  locale,
  image,
  openGraphType = "website",
  keywords,
  robots,
  absoluteTitle = false,
}: BuildPageMetadataOpts): Metadata {
  const cleanTitle = stripBrandTitleSuffix(title)
  const normalized = normalizePath(path)
  const pageUrl = `${SITE_URL}/${locale}${normalized}`
  const ogImage = image || DEFAULT_OG_IMAGE
  const alternates = buildAlternates(path, locale)

  return {
    title: absoluteTitle ? { absolute: cleanTitle } : cleanTitle,
    ...(description ? { description } : {}),
    ...(keywords ? { keywords } : {}),
    ...(robots ? { robots } : {}),
    openGraph: {
      title: cleanTitle,
      ...(description ? { description } : {}),
      url: pageUrl,
      locale,
      type: openGraphType,
      siteName: "Koleqcia",
      images: [{ url: ogImage }],
    },
    twitter: buildTwitter(cleanTitle, description, ogImage),
    alternates,
  }
}
