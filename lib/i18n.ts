export const LOCALES = ["en", "ka", "ru"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "en"

export function isValidLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale)
}

/**
 * Build a locale-prefixed path. Strips any existing locale prefix first.
 */
export function localizedPath(path: string, locale: Locale): string {
  const stripped = stripLocalePrefix(path)
  return `/${locale}${stripped.startsWith("/") ? stripped : `/${stripped}`}`
}

/**
 * Remove a leading locale segment from a path.
 */
export function stripLocalePrefix(path: string): string {
  const segments = path.split("/").filter(Boolean)
  if (segments.length > 0 && isValidLocale(segments[0])) {
    segments.shift()
  }
  return `/${segments.join("/")}`
}

/**
 * Extract the locale from a path. Returns DEFAULT_LOCALE if none found.
 */
export function getLocaleFromPath(path: string): Locale {
  const segments = path.split("/").filter(Boolean)
  if (segments.length > 0 && isValidLocale(segments[0])) {
    return segments[0]
  }
  return DEFAULT_LOCALE
}
