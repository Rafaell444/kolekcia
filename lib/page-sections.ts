const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

export type PageSection = {
  id: number
  page: string
  section_key: string
  title: string
  title_ka?: string | null
  title_ru?: string | null
  content: Record<string, unknown>
  content_ka?: Record<string, unknown> | null
  content_ru?: Record<string, unknown> | null
  sort_order: number
  is_active: boolean
}

export async function fetchPageSections(page: string, locale = "en"): Promise<PageSection[]> {
  try {
    const res = await fetch(`${API_BASE}/cms/pages/${page}/?lang=${locale}`, {
      headers: { "Accept-Language": locale },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    return await res.json() as PageSection[]
  } catch {
    return []
  }
}

function mergeLocalized(base: unknown, localized: unknown): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(localized)) return base
    return base.map((item, index) => mergeLocalized(item, localized[index]))
  }
  if (base && typeof base === "object") {
    const source = localized && typeof localized === "object" && !Array.isArray(localized)
      ? localized as Record<string, unknown>
      : {}
    return Object.fromEntries(
      Object.entries(base as Record<string, unknown>).map(([key, value]) => [key, mergeLocalized(value, source[key])]),
    )
  }
  if (typeof localized === "string") return localized.trim() ? localized : base
  return localized ?? base
}

export function sectionContent<T extends Record<string, unknown>>(
  sections: PageSection[],
  key: string,
  locale = "en",
): T | null {
  const s = sections.find((x) => x.section_key === key)
  if (!s) return null
  if (locale === "ka" && s.content_ka && Object.keys(s.content_ka).length > 0) return mergeLocalized(s.content, s.content_ka) as T
  if (locale === "ru" && s.content_ru && Object.keys(s.content_ru).length > 0) return mergeLocalized(s.content, s.content_ru) as T
  return (s.content as T) ?? null
}

export async function fetchSiteSettings(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${API_BASE}/cms/settings/`, { next: { revalidate: 300 } })
    if (!res.ok) return {}
    return await res.json() as Record<string, string>
  } catch {
    return {}
  }
}
