"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Palette } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

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

export default function AdminArtistsPage(): React.ReactElement {
  const [vendors, setVendors] = useState<VendorArtist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminFetch<VendorArtist[]>("/vendors/me/")
      .then((rows) => {
        if (cancelled) return
        setVendors((Array.isArray(rows) ? rows : []).filter((vendor) => SHOWCASE_SLUGS.has(vendor.catalog_category_slug)))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Artists</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Manage the two public artist vendor studios shown on the storefront.</p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-64 bg-dp-bg-elevated rounded-sm" />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="py-16 text-center border border-dp-border bg-dp-bg-surface rounded-sm">
          <Palette size={32} className="mx-auto mb-3 text-dp-text-tertiary" />
          <p className="text-[13px] text-dp-text-tertiary">No artist vendors found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {vendors.map((vendor) => {
            const category = vendor.catalog_category_slug
            const label = CATEGORY_LABELS[category] ?? category
            return (
              <article key={vendor.id} className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
                <div className="relative h-36 bg-dp-bg-elevated overflow-hidden">
                  {(vendor.banner_url || vendor.logo_url) ? (
                    <Image
                      src={vendor.banner_url || vendor.logo_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="h-full w-full bg-dp-bg-elevated" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dp-bg-surface via-dp-bg-surface/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-gold mb-1">{label}</p>
                    <h2 className="font-display text-2xl text-dp-text-primary">{vendor.name}</h2>
                  </div>
                </div>
                <div className="px-4 py-4 flex items-center justify-between gap-3">
                  <p className="text-[12px] text-dp-text-secondary line-clamp-2 leading-relaxed">
                    {vendor.description || `Shop the full ${label.toLowerCase()} collection.`}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/catalog?category=${category}`} target="_blank" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta hover:underline">
                      Shop <ArrowRight size={12} />
                    </Link>
                    <Link href={`/admin/vendors`} className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary hover:text-dp-text-primary">
                      Edit
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
