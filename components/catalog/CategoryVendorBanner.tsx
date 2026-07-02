"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { apiFetch } from "@/lib/api"

type StorefrontVendor = {
  name: string
  slug: string
  logo_url: string
  banner_url: string
  description: string
  social_instagram: string
  social_facebook: string
  social_tiktok: string
  social_youtube: string
}

const CATEGORY_META: Record<string, { label: string; gradient: string; banner: string }> = {
  figures: {
    label: "Figures",
    gradient: "from-violet-950/50 via-dp-bg-elevated to-dp-bg-surface",
    banner: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&h=600&fit=crop",
  },
  wallpanels: {
    label: "Wallpanels",
    gradient: "from-amber-950/40 via-dp-bg-elevated to-dp-bg-surface",
    banner: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1600&h=600&fit=crop",
  },
}

const SOCIALS: {
  key: keyof Pick<StorefrontVendor, "social_instagram" | "social_facebook" | "social_tiktok" | "social_youtube">
  label: string
  abbrev: string
}[] = [
  { key: "social_facebook", label: "Facebook", abbrev: "FB" },
  { key: "social_instagram", label: "Instagram", abbrev: "IG" },
  { key: "social_tiktok", label: "TikTok", abbrev: "TT" },
  { key: "social_youtube", label: "YouTube", abbrev: "YT" },
]

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-sm border border-dp-border bg-dp-bg-surface/80 backdrop-blur-sm text-dp-text-secondary hover:text-dp-accent-cta hover:border-dp-border-hover transition-colors"
    >
      {children}
    </a>
  )
}

function BannerSkeleton() {
  return (
    <section className="border-b border-dp-border bg-dp-bg-surface animate-pulse" aria-hidden>
      <div className="h-40 sm:h-48 md:h-56 bg-dp-bg-elevated" />
    </section>
  )
}

export default function CategoryVendorBanner({ categorySlug }: { categorySlug: string }) {
  const [vendor, setVendor] = useState<StorefrontVendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [bannerFailed, setBannerFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setBannerFailed(false)
    apiFetch<StorefrontVendor>(`/vendors/public/by-category/${categorySlug}/`)
      .then((d) => { if (!cancelled) setVendor(d) })
      .catch(() => { if (!cancelled) setVendor(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [categorySlug])

  if (loading) return <BannerSkeleton />
  if (!vendor) return null

  const meta = CATEGORY_META[categorySlug] ?? {
    label: categorySlug,
    gradient: "from-dp-bg-elevated to-dp-bg-surface",
    banner: "",
  }
  const bannerSrc = !bannerFailed && vendor.banner_url ? vendor.banner_url : meta.banner
  const socialLinks = SOCIALS.filter((s) => vendor[s.key]?.trim())

  return (
    <section className="border-b border-dp-border bg-dp-bg-surface overflow-hidden" aria-label={`${vendor.name} storefront`}>
      <div className="relative w-full min-h-[160px] sm:min-h-[200px] md:min-h-[240px] lg:min-h-[260px]">
        {bannerSrc ? (
          <Image
            key={bannerSrc}
            src={bannerSrc}
            alt=""
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
            onError={() => setBannerFailed(true)}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient}`} aria-hidden />
        )}

        <div
          className="absolute inset-0 bg-gradient-to-r from-dp-bg-surface via-dp-bg-surface/92 to-dp-bg-surface/55 sm:to-dp-bg-surface/35 lg:to-transparent"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dp-bg-surface via-transparent to-dp-bg-surface/20" aria-hidden />

        <div className="relative dp-container flex flex-col justify-center min-h-[inherit] py-8 sm:py-10 md:py-12">
          <div className="w-full flex flex-col gap-6 lg:gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 min-w-0 flex-1">
              {vendor.logo_url ? (
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-sm border-2 border-dp-border overflow-hidden bg-dp-bg-elevated shrink-0 shadow-lg">
                  <Image src={vendor.logo_url} alt={vendor.name} fill className="object-cover" sizes="112px" />
                </div>
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-sm border-2 border-dp-border bg-dp-bg-elevated shrink-0 shadow-lg flex items-center justify-center">
                  <span className="font-display text-4xl sm:text-5xl text-dp-text-primary">{vendor.name.charAt(0)}</span>
                </div>
              )}

              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span className="inline-flex self-start items-center px-2.5 py-1 mb-2 sm:mb-3 rounded-sm border border-dp-border bg-dp-bg-surface/80 text-[10px] font-bold uppercase tracking-[0.16em] text-dp-text-tertiary">
                  Official {meta.label}
                </span>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-dp-text-primary leading-none break-words">
                  {vendor.name}
                </h2>
                {vendor.description ? (
                  <p className="mt-3 sm:mt-4 text-[13px] sm:text-[14px] md:text-[15px] text-dp-text-secondary leading-relaxed max-w-2xl lg:max-w-3xl">
                    {vendor.description}
                  </p>
                ) : null}
              </div>
            </div>

            {socialLinks.length > 0 && (
              <div className="w-full lg:w-auto shrink-0 border-t border-dp-border/60 lg:border-t-0 lg:border-l lg:pl-8 pt-5 lg:pt-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dp-text-tertiary mb-3">
                  Connect with us
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  {socialLinks.map(({ key, label, abbrev }) => (
                    <SocialLink key={key} href={vendor[key]} label={label}>
                      <span className="text-[11px] font-black">{abbrev}</span>
                    </SocialLink>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
