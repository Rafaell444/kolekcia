"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import type { PageSection } from "@/lib/page-sections"

const sectionCache = new Map<string, PageSection[]>()

export function usePageSections(page: string): { sections: PageSection[]; loaded: boolean } {
  const cached = sectionCache.get(page)
  const [sections, setSections] = useState<PageSection[]>(cached ?? [])
  const [loaded, setLoaded] = useState(Boolean(cached))

  useEffect(() => {
    let cancelled = false
    apiFetch<PageSection[]>(`/cms/pages/${page}/`)
      .then((data) => {
        if (cancelled) return
        const next = Array.isArray(data) ? data : []
        sectionCache.set(page, next)
        setSections(next)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [page])

  return { sections, loaded }
}
