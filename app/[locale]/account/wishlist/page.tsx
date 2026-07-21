"use client"

import React, { useEffect, useState } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Link from "next/link"
import Image from "next/image"
import { Heart, ArrowRight, Trash2 } from "lucide-react"
import { authFetch } from "@/lib/api"
import { useLocale } from "@/contexts/locale-context"
import { productHref } from "@/lib/product-url"
import { useLocalePrefix } from "@/lib/use-localized-href"

type WishlistProduct = {
  id: string
  slug?: string
  category_slug?: string
  title: string
  artist_name: string
  base_price: string
  image_url: string
}

type WishlistItem = {
  id: number
  product: WishlistProduct
  added_at: string
}

export default function WishlistPage(): React.ReactElement {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const { formatPrice } = useLocale()
  const lp = useLocalePrefix()

  useEffect(() => {
    let cancelled = false
    authFetch<WishlistItem[] | { results: WishlistItem[] }>("/products/wishlist/")
      .then((d) => { if (!cancelled) setItems(Array.isArray(d) ? d : (d.results ?? [])) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function removeItem(productId: string) {
    await authFetch(`/products/wishlist/${productId}/`, { method: "DELETE" }).catch(() => {})
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-4xl text-dp-text-primary">Wishlist</h1>
          <Link href={`${lp}/catalog`} className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
            Browse More <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
            {[1,2,3,4].map((i) => <div key={i} className="aspect-poster bg-dp-bg-elevated rounded-sm" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24">
            <Heart size={40} className="text-dp-text-tertiary" />
            <p className="text-dp-text-secondary">No saved items yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              const p = item.product
              const price = parseFloat(p.base_price) // kept for discount % calc
              return (
                <div key={item.id} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover relative">
                  <button
                    onClick={() => removeItem(p.id)}
                    className="absolute top-2 right-2 z-10 w-7 h-7 bg-dp-bg-base/80 rounded-sm flex items-center justify-center text-dp-accent-cta hover:bg-dp-accent-cta hover:text-white transition-colors"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 size={12} />
                  </button>
                  <Link href={productHref({ id: p.id, slug: p.slug, categorySlug: p.category_slug })}>
                    <div className="aspect-poster relative bg-dp-bg-elevated overflow-hidden">
                      {p.image_url && (
                        <Image
                          src={p.image_url}
                          alt={p.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, 25vw"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] text-dp-text-tertiary truncate">{p.artist_name}</p>
                      <p className="text-[13px] font-semibold text-dp-text-primary truncate mt-0.5">{p.title}</p>
                      <p className="text-[14px] font-bold text-dp-text-primary mt-1">
                        {isNaN(price) ? "" : formatPrice(price)}
                      </p>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
