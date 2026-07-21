import type { MetadataRoute } from "next"
import { LOCALES } from "@/lib/i18n"

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

const STATIC_PATHS = [
  { path: "/", changeFrequency: "daily" as const, priority: 1 },
  { path: "/catalog", changeFrequency: "hourly" as const, priority: 0.9 },
  { path: "/auctions", changeFrequency: "hourly" as const, priority: 0.8 },
  { path: "/custom", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/artists", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/faq", changeFrequency: "monthly" as const, priority: 0.4 },
  { path: "/shipping", changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/returns", changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.2 },
  { path: "/cookies", changeFrequency: "yearly" as const, priority: 0.1 },
]

type Paginated<T> = { results?: T[]; next?: string | null; count?: number }

function localeAlternates(path: string): Record<string, string> {
  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) {
    alternates[loc] = `${BASE}/${loc}${path}`
  }
  return alternates
}

function pushLocaleEntries(
  entries: MetadataRoute.Sitemap,
  path: string,
  opts: { changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number; lastModified?: Date },
) {
  for (const locale of LOCALES) {
    entries.push({
      url: `${BASE}/${locale}${path}`,
      lastModified: opts.lastModified ?? new Date(),
      changeFrequency: opts.changeFrequency,
      priority: opts.priority,
      alternates: { languages: localeAlternates(path) },
    })
  }
}

async function fetchAllProducts(): Promise<{ slug: string; updated?: string }[]> {
  const items: { slug: string; updated?: string }[] = []
  // Backend max_page_size is 48
  let page = 1
  const pageSize = 48

  for (;;) {
    const res = await fetch(`${API_URL}/products/?page=${page}&page_size=${pageSize}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) break
    const data = (await res.json()) as Paginated<{ slug?: string; id?: number }>
    const results = data.results ?? (Array.isArray(data) ? (data as { slug?: string; id?: number }[]) : [])
    for (const p of results) {
      if (p.slug) items.push({ slug: p.slug })
    }
    if (!data.next || results.length === 0) break
    page += 1
    if (page > 100) break
  }

  return items
}

async function fetchAuctions(): Promise<{ id: number | string; slug?: string }[]> {
  const res = await fetch(`${API_URL}/auctions/`, { next: { revalidate: 3600 } })
  if (!res.ok) return []
  const data = await res.json()
  const results = Array.isArray(data) ? data : (data.results ?? [])
  return results as { id: number | string; slug?: string }[]
}

async function fetchBlogPosts(): Promise<{ slug: string; published_at?: string }[]> {
  const res = await fetch(`${API_URL}/blog/`, { next: { revalidate: 3600 } })
  if (!res.ok) return []
  const data = await res.json()
  const results = Array.isArray(data) ? data : (data.results ?? [])
  return results as { slug: string; published_at?: string }[]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  for (const { path, changeFrequency, priority } of STATIC_PATHS) {
    pushLocaleEntries(entries, path, { changeFrequency, priority })
  }

  try {
    const [products, auctions, posts] = await Promise.all([
      fetchAllProducts().catch(() => []),
      fetchAuctions().catch(() => []),
      fetchBlogPosts().catch(() => []),
    ])

    for (const product of products) {
      pushLocaleEntries(entries, `/catalog/${product.slug}`, {
        changeFrequency: "daily",
        priority: 0.8,
      })
    }

    for (const auction of auctions) {
      const key = auction.slug || String(auction.id)
      pushLocaleEntries(entries, `/auctions/${key}`, {
        changeFrequency: "hourly",
        priority: 0.7,
      })
    }

    for (const post of posts) {
      if (!post.slug) continue
      pushLocaleEntries(entries, `/blog/${post.slug}`, {
        changeFrequency: "weekly",
        priority: 0.6,
        lastModified: post.published_at ? new Date(post.published_at) : new Date(),
      })
    }
  } catch {
    // Graceful fallback: static entries only
  }

  return entries
}
