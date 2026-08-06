"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import type { PageSection } from "@/lib/page-sections"

const sectionCache = new Map<string, PageSection[]>()

export function usePageSections(page: string, locale: string, initialSections: PageSection[] = []): { sections: PageSection[]; loaded: boolean } {
  const cacheKey = `${page}:${locale}`
  const cached = sectionCache.get(cacheKey)
  const [sections, setSections] = useState<PageSection[]>(cached ?? initialSections)
  const [loaded, setLoaded] = useState(Boolean(cached) || initialSections.length > 0)

  useEffect(() => {
    let cancelled = false
    apiFetch<PageSection[]>(`/cms/pages/${page}/?lang=${locale}`)
      .then((data) => {
        if (cancelled) return
        const next = Array.isArray(data) ? data : []
        sectionCache.set(cacheKey, next)
        setSections(next)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [cacheKey, page])

  return { sections, loaded }
}
