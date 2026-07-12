"use client"

import React, { useState, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Link from "next/link"
import Image from "next/image"
import { Palette, ArrowRight } from "lucide-react"
import { apiFetch, parseList, type PaginatedResponse } from "@/lib/api"

type VendorArtist = {
  id: number
  name: string
  slug: string
  logo_url: string
  banner_url: string
  description: string
  catalog_category_slug: string
}

const CATEGORY_LABELS: Record<string, string> = {
  figures: "Figures",
  wallpanels: "Wallpanels",
}

const SHOWCASE_SLUGS = new Set(["figures", "wallpanels"])

export default function ArtistsPage() {
  const [vendors, setVendors] = useState<VendorArtist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<VendorArtist[] | PaginatedResponse<VendorArtist>>("/vendors/public/")
      .then((d) => {
        const list = parseList(d).filter((v) => SHOWCASE_SLUGS.has(v.catalog_category_slug))
        setVendors(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <SiteShell>
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-12">
          <h1 className="font-display text-5xl md:text-6xl text-dp-text-primary mb-3">Artists</h1>
          <p className="text-dp-text-secondary text-[14px] max-w-lg">
            Browse our partner studios — each with their own curated collection of wallpanels or figures.
          </p>
        </div>
      </div>

      <div className="dp-container py-10 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 bg-dp-bg-elevated animate-pulse rounded-sm" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="py-20 text-center">
            <Palette size={36} className="opacity-20 mx-auto mb-3" />
            <p className="text-dp-text-tertiary">No artist studios available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {vendors.map((vendor) => {
              const category = vendor.catalog_category_slug
              const label = CATEGORY_LABELS[category] ?? category
              const href = `/catalog?category=${category}`
              return (
                <Link
                  key={vendor.id}
                  href={href}
                  className="group block bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover"
                >
                  <div className="relative h-36 bg-dp-bg-elevated overflow-hidden">
                    {(vendor.banner_url || vendor.logo_url) ? (
                      <Image
                        src={vendor.banner_url || vendor.logo_url}
                        alt=""
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-dp-accent-cta/10 to-dp-bg-base" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-dp-bg-surface via-dp-bg-surface/40 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-gold mb-1">{label}</p>
                      <p className="font-display text-2xl text-dp-text-primary group-hover:text-dp-accent-cta transition-colors">
                        {vendor.name}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-4 flex items-center justify-between gap-3">
                    <p className="text-[12px] text-dp-text-secondary line-clamp-2 leading-relaxed">
                      {vendor.description || `Shop the full ${label.toLowerCase()} collection.`}
                    </p>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta">
                      Shop <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
