"use client"

import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import { useLocale } from "@/contexts/locale-context"
import { productHref } from "@/lib/product-url"

type ApiProduct = {
  id: number
  slug?: string
  category_slug?: string
  title: string
  artist_name: string
  base_price: string
  original_price: string | null
  rating: string
  review_count: number
  image_url: string
  is_limited: boolean
  is_sale: boolean
  is_new: boolean
  is_exclusive: boolean
}

export default function HomeProductCard({ product }: { product: ApiProduct }) {
  const { formatPrice } = useLocale()
  const price = parseFloat(product.base_price)
  const original = product.original_price ? parseFloat(product.original_price) : null
  const discount = original ? Math.round(((original - price) / original) * 100) : null

  return (
    <Link href={productHref({ id: product.id, slug: product.slug, categorySlug: product.category_slug })}>
      <article className="group relative bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover cursor-pointer">
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {product.is_limited && <span className="badge-limited">Limited</span>}
          {product.is_sale && discount && <span className="badge-sale">-{discount}%</span>}
          {product.is_new && <span className="badge-limited" style={{ background: "var(--dp-success)", color: "#fff" }}>New</span>}
          {product.is_exclusive && <span className="badge-limited" style={{ background: "var(--dp-accent-gold)", color: "#111113" }}>Exclusive</span>}
        </div>
        <div className="aspect-poster relative overflow-hidden bg-dp-bg-elevated">
          {product.image_url && (
            <Image src={product.image_url} alt={product.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
          )}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-dp-bg-base/90 px-3 py-2.5">
            <span className="w-full block text-[11px] font-bold uppercase tracking-widest text-white bg-dp-accent-cta hover:bg-dp-accent-cta-hover py-1.5 rounded-sm text-center">+ Add to Cart</span>
          </div>
        </div>
        <div className="p-3">
          <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest truncate mb-0.5">{product.artist_name}</p>
          <h3 className="text-[13px] font-semibold text-dp-text-primary truncate leading-tight">{product.title}</h3>
          <div className="flex items-center gap-1 mt-1 mb-2">
            <Star size={10} className="fill-dp-accent-gold text-dp-accent-gold" aria-hidden />
            <span className="text-[11px] text-dp-text-secondary">{parseFloat(product.rating).toFixed(1)}</span>
            <span className="text-[11px] text-dp-text-tertiary">({product.review_count.toLocaleString("en-US")})</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold text-dp-text-primary">{formatPrice(price)}</span>
            {original && <span className="text-[12px] text-dp-text-tertiary line-through">{formatPrice(original)}</span>}
          </div>
        </div>
      </article>
    </Link>
  )
}
