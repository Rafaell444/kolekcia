"use client"

import Image from "next/image"
import Link from "next/link"
import { ShoppingCart, Heart, Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/contexts/cart-context"
import { useWishlist } from "@/contexts/wishlist-context"
import { useLocale } from "@/contexts/locale-context"
import { formatAmount } from "@/lib/product-pricing"
import { getAccessToken } from "@/lib/auth-storage"
import { savePendingCartIntent } from "@/lib/pending-cart"
import { getApiErrorMessage } from "@/lib/api"
import { productHref } from "@/lib/product-url"

export type ProductCardProps = {
  product: {
    id: string
    title: string
    artistName: string
    imageUrl: string
    price: number
    originalPrice?: number | null
    rating?: number
    reviews?: number
    isLimited?: boolean
    isSale?: boolean
    isNew?: boolean
    isExclusive?: boolean
    tags?: string[]
    category?: string
    slug?: string
    defaultVariantId?: number | null
    defaultSizeVariantId?: number | null
    priceIsLocalized?: boolean
    hasMultipleVariants?: boolean
    isSoldOut?: boolean
  }
}

export default function ProductCard({ product: p }: ProductCardProps) {
  const href = productHref({ id: p.id, slug: p.slug, categorySlug: p.category })
  const router = useRouter()
  const { addItem } = useCart()
  const { isWishlisted, toggle: toggleWishlist } = useWishlist()
  const { formatPrice, currency } = useLocale()
  const [adding, setAdding]           = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [cartError, setCartError]     = useState("")
  const [wishWorking, setWishWorking] = useState(false)

  const displayPrice = (amount: number | null | undefined) =>
    p.priceIsLocalized ? formatAmount(amount, currency) : formatPrice(amount)

  const wishlisted = isWishlisted(Number(p.id))

  const discountPct =
    p.originalPrice && p.originalPrice > p.price
      ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
      : null

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!getAccessToken()) {
      if (p.defaultSizeVariantId) {
        savePendingCartIntent({
          sizeVariantId: p.defaultSizeVariantId,
          quantity: 1,
          returnTo: href,
        })
      } else if (p.defaultVariantId) {
        savePendingCartIntent({
          variantId: p.defaultVariantId,
          quantity: 1,
          returnTo: href,
        })
      }
      router.push(`/login?next=${encodeURIComponent(href)}`)
      return
    }

    if (!p.defaultVariantId && !p.defaultSizeVariantId) {
      router.push(href)
      return
    }

    setAdding(true)
    setCartError("")
    try {
      if (p.defaultSizeVariantId) {
        await addItem(null, 1, { size_variant_id: p.defaultSizeVariantId })
      } else if (p.defaultVariantId) {
        await addItem(p.defaultVariantId, 1)
      }
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 1800)
    } catch (err) {
      setCartError(getApiErrorMessage(err, "Could not add to cart. Please try again."))
    } finally {
      setAdding(false)
    }
  }

  async function handleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!getAccessToken()) {
      router.push(`/login?next=${encodeURIComponent(href)}`)
      return
    }

    setWishWorking(true)
    try {
      await toggleWishlist(Number(p.id))
    } finally {
      setWishWorking(false)
    }
  }

  return (
    <Link
      href={href}
      className="group relative flex flex-col bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-dp-accent-cta"
      aria-label={`${p.title} by ${p.artistName} — ${displayPrice(p.price)}`}
    >
      {/* ── Image ── */}
      <div className="relative aspect-poster overflow-hidden bg-dp-bg-elevated">
        {p.imageUrl ? (
          <Image
            src={p.imageUrl}
            alt={p.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-dp-text-tertiary text-[11px] uppercase tracking-widest">
            No image
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1" aria-label="Product badges">
          {p.isSoldOut ? (
            <span className="badge-limited">Sold Out</span>
          ) : (
            <>
              {p.isNew       && <span className="badge-sale">New</span>}
              {p.isExclusive && <span className="badge-limited">Exclusive</span>}
              {p.isSale && discountPct && (
                <span className="badge-sale">-{discountPct}%</span>
              )}
              {p.isLimited   && <span className="badge-limited">Limited</span>}
            </>
          )}
        </div>

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          disabled={wishWorking}
          className={`absolute top-2 right-2 w-7 h-7 rounded-sm flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-60 ${
            wishlisted
              ? "bg-dp-accent-cta text-white"
              : "bg-black/40 text-white hover:bg-black/60"
          }`}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wishlisted}
        >
          {wishWorking
            ? <Loader2 size={11} className="animate-spin" />
            : <Heart size={13} fill={wishlisted ? "currentColor" : "none"} />}
        </button>

        {/* Quick add overlay */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <button
            onClick={handleAddToCart}
            disabled={adding}
            className={`w-full py-2.5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-60 ${
              addedToCart
                ? "bg-dp-success text-white"
                : "bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white"
            }`}
            aria-label={addedToCart ? "Added to cart" : `Add ${p.title} to cart`}
          >
            {adding
              ? <Loader2 size={11} className="animate-spin" />
              : addedToCart
                ? <><Check size={12} aria-hidden /> Added!</>
                : <><ShoppingCart size={12} aria-hidden /> Quick Add</>}
          </button>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="flex flex-col gap-1 px-3 py-2.5 flex-1">
        <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest truncate">
          {p.artistName}
        </p>
        <h3 className="text-[13px] font-semibold text-dp-text-primary leading-tight line-clamp-2 group-hover:text-dp-accent-gold transition-colors">
          {p.title}
        </h3>
      </div>

      {/* ── Price ── */}
      <div className="flex flex-col gap-1 px-3 pb-3 mt-auto">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-dp-text-primary">
            {displayPrice(p.price)}{p.hasMultipleVariants && <span className="text-[11px] font-normal text-dp-text-tertiary ml-0.5">–დან</span>}
          </span>
          {p.originalPrice && p.originalPrice > p.price && (
            <span className="text-[12px] text-dp-text-tertiary line-through">
              {displayPrice(p.originalPrice)}
            </span>
          )}
        </div>
        {cartError && (
          <p className="text-[10px] text-dp-accent-cta leading-tight">{cartError}</p>
        )}
      </div>
    </Link>
  )
}
