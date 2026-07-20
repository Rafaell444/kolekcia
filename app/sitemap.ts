import type { MetadataRoute } from "next"
import { LOCALES } from "@/lib/i18n"

const BASE = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

const STATIC_PATHS = [
  { path: "/",          changeFrequency: "daily" as const,   priority: 1 },
  { path: "/catalog",   changeFrequency: "hourly" as const,  priority: 0.9 },
  { path: "/auctions",  changeFrequency: "hourly" as const,  priority: 0.8 },
  { path: "/custom",    changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/artists",   changeFrequency: "weekly" as const,  priority: 0.7 },
  { path: "/blog",      changeFrequency: "weekly" as const,  priority: 0.6 },
  { path: "/contact",   changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/about",     changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/faq",       changeFrequency: "monthly" as const, priority: 0.4 },
  { path: "/shipping",  changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/returns",   changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/privacy",   changeFrequency: "yearly" as const,  priority: 0.2 },
  { path: "/terms",     changeFrequency: "yearly" as const,  priority: 0.2 },
  { path: "/cookies",   changeFrequency: "yearly" as const,  priority: 0.1 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const { path, changeFrequency, priority } of STATIC_PATHS) {
    for (const locale of LOCALES) {
      const alternates: Record<string, string> = {}
      for (const loc of LOCALES) {
        alternates[loc] = `${BASE}/${loc}${path}`
      }
      entries.push({
        url: `${BASE}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
        alternates: { languages: alternates },
      })
    }
  }

  return entries
}
