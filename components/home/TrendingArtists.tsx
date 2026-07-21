import React from "react"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import LocalizedLink from "@/components/seo/LocalizedLink"
import { parseList, type PaginatedResponse } from "@/lib/api"

type VendorArtist = {
  id: number
  name: string
  slug: string
  logo_url: string
  banner_url: string
  description: string
  catalog_category_slug: string
}

const SHOWCASE_SLUGS = new Set(["figures", "wallpanels"])

async function getVendorArtists(): Promise<VendorArtist[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  try {
    const res = await fetch(`${apiUrl}/vendors/public/`, { next: { revalidate: 600 } })
    if (!res.ok) return []
    const data = await res.json() as VendorArtist[] | PaginatedResponse<VendorArtist>
    return parseList(data).filter((v) => SHOWCASE_SLUGS.has(v.catalog_category_slug))
  } catch {
    return []
  }
}

export default async function TrendingArtists(): Promise<React.ReactElement> {
  const vendors = await getVendorArtists()

  if (vendors.length === 0) return <></>

  return (
    <section className="dp-container pb-14" aria-labelledby="artists-heading">
      <div className="flex items-end justify-between mb-6">
        <h2 className="font-display text-3xl md:text-4xl text-dp-text-primary" id="artists-heading">Our Artists</h2>
        <LocalizedLink href="/artists" className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
          View Studios <ArrowRight size={12} />
        </LocalizedLink>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
        {vendors.map((vendor) => (
          <LocalizedLink
            key={vendor.id}
            href={`/catalog?category=${vendor.catalog_category_slug}`}
            className="group flex items-center gap-4 p-4 bg-dp-bg-surface border border-dp-border rounded-sm dp-card-hover"
          >
            <div className="relative w-16 h-16 rounded-sm overflow-hidden border border-dp-border shrink-0 bg-dp-bg-elevated">
              {vendor.logo_url && (
                <Image src={vendor.logo_url} alt={vendor.name} fill className="object-cover" sizes="64px" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-gold">
                {vendor.catalog_category_slug === "figures" ? "Figures" : "Wallpanels"}
              </p>
              <p className="text-[15px] font-semibold text-dp-text-primary group-hover:text-dp-accent-cta transition-colors truncate">
                {vendor.name}
              </p>
              <p className="text-[11px] text-dp-text-tertiary truncate">Browse the full collection</p>
            </div>
            <ArrowRight size={14} className="text-dp-text-tertiary group-hover:text-dp-accent-cta shrink-0" />
          </LocalizedLink>
        ))}
      </div>
    </section>
  )
}
