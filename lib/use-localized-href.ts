"use client"

import { useParams } from "next/navigation"
import { type Locale, DEFAULT_LOCALE, isValidLocale } from "./i18n"

export function useLocalePrefix(): string {
  const params = useParams()
  const locale = (params?.locale as string) ?? DEFAULT_LOCALE
  return isValidLocale(locale) ? `/${locale}` : `/${DEFAULT_LOCALE}`
}

export function useLocalizedHref(path: string): string {
  const prefix = useLocalePrefix()
  if (path.startsWith("http") || path.startsWith("#") || path.startsWith("/admin") || path.startsWith("/api")) {
    return path
  }
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`
}
