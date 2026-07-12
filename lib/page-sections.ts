const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

export type PageSection = {
  id: number
  page: string
  section_key: string
  title: string
  content: Record<string, unknown>
  sort_order: number
  is_active: boolean
}

export async function fetchPageSections(page: string): Promise<PageSection[]> {
  try {
    const res = await fetch(`${API_BASE}/cms/pages/${page}/`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return await res.json() as PageSection[]
  } catch {
    return []
  }
}

export function sectionContent<T extends Record<string, unknown>>(
  sections: PageSection[],
  key: string,
): T | null {
  const s = sections.find((x) => x.section_key === key)
  return (s?.content as T) ?? null
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
