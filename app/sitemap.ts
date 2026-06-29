import type { MetadataRoute } from "next"

const BASE = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`,           lastModified: new Date(), changeFrequency: "daily",   priority: 1 },
    { url: `${BASE}/catalog`,    lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE}/auctions`,   lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE}/custom`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/login`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/register`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ]
}
