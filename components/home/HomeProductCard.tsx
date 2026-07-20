"use client"

import Image from "next/image"
import Link from "next/link"
import { useLocale } from "@/contexts/locale-context"
import { productHref } from "@/lib/product-url"
import { useLocalePrefix } from "@/lib/use-localized-href"
import { resolveListProductPrice, formatAmount } from "@/lib/product-pricing"
import type { SizeVariantPrice } from "@/lib/product-pricing"

type ApiProduct = {
  id: number
  slug?: string
  category_slug?: string
  title: string
  artist_name: string
  base_price: string
  original_price: string | null
  regional_prices?: Record<string, unknown>
  rating: string
  review_count: number
  image_url: string
  is_limited: boolean
  is_sale: boolean
  is_new: boolean
  is_exclusive: boolean
  is_featured?: boolean
  size_variants?: SizeVariantPrice[]
}

export default function HomeProductCard({ product }: { product: ApiProduct }) {
  const lp = useLocalePrefix()
  const { currency, rates } = useLocale()
  const { price, original } = resolveListProductPrice(product, currency, rates)
  const discount = original && original > price ? Math.round(((original - price) / original) * 100) : null

  const activeVariants = (product.size_variants ?? []).filter((sv) => sv.is_active !== false)
  const showFrom = activeVariants.length > 1

  return (
    <Link href={`${lp}${productHref({ id: product.id, slug: product.slug, categorySlug: product.category_slug })}`}>
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
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[15px] font-bold text-dp-text-primary">
              {formatAmount(price, currency)}{showFrom && <span className="text-[11px] font-normal text-dp-text-tertiary ml-0.5">–დან</span>}
            </span>
            {original && original > price && (
              <span className="text-[12px] text-dp-text-tertiary line-through">{formatAmount(original, currency)}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
