"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import { apiFetch, authFetch, getApiErrorMessage } from "@/lib/api"
import { useCart } from "@/contexts/cart-context"
import { useWishlist } from "@/contexts/wishlist-context"
import { useLocale } from "@/contexts/locale-context"
import { getAccessToken } from "@/lib/auth-storage"
import { savePendingCartIntent } from "@/lib/pending-cart"
import { productHref } from "@/lib/product-url"
import { formatAmount, resolveProductPrices, resolveSizeVariantPrice } from "@/lib/product-pricing"
import {
  ChevronLeft, ShoppingCart, Heart, Share2, Shield, Truck,
  RotateCcw, Check, Zap, ArrowRight, Award, Package,
  Sparkles, Clock, ChevronDown, ChevronUp, Loader2,
  MessageSquare, X, Send, Layers, Box, Palette, Gift, Play, Upload, ImageIcon, PackageCheck,
} from "lucide-react"
import ProductCmsSections, { type ProductCmsContent } from "@/components/product/ProductCmsSections"
import Breadcrumb from "@/components/seo/Breadcrumb"

// ── Variant selector ──────────────────────────────────────
function VariantSelector<T extends { id: string; label: string; surcharge: number }>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string
  options: T[]
  selected: string
  onSelect: (id: string) => void
}) {
  const { formatPrice } = useLocale()
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`px-3 py-2 rounded-sm border text-[12px] font-semibold transition-colors ${
              selected === opt.id
                ? "border-dp-accent-cta text-dp-text-primary bg-dp-accent-cta/10"
                : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover"
            }`}
            aria-pressed={selected === opt.id}
          >
            {opt.label}
            {opt.surcharge > 0 && (
              <span className="ml-1 text-dp-text-tertiary">+{formatPrice(opt.surcharge)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Accordion item ────────────────────────────────────────
function AccordionItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-dp-border last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[13px] font-bold uppercase tracking-widest text-dp-text-primary">{title}</span>
        {open
          ? <ChevronUp size={15} className="text-dp-text-tertiary" />
          : <ChevronDown size={15} className="text-dp-text-tertiary" />}
      </button>
      {open && (
        <div className="pb-4 text-[13px] text-dp-text-secondary leading-relaxed">{children}</div>
      )}
    </div>
  )
}

type ApiVariantOption = { id: string; label: string; surcharge: number }
type ApiVariant = {
  id: number
  size: { id: string; label: string; surcharge: number }
  finish: { id: string; label: string; surcharge: number }
  frame: { id: string; label: string; surcharge: number }
  stock: number
}
type SizeVariant = {
  id: number
  label: string
  price_usd: string
  price_gel?: string | null
  price_eur?: string | null
  price_gbp?: string | null
  sale_price_usd?: string | null
  sale_price_gel?: string | null
  sort_order: number
  is_active: boolean
}
type ProcessingOpt = { id: number; slug: string; label: string; price_usd: string; price_gel: string; est_days_min: number; est_days_max: number }
type ApiProduct = {
  id: number; slug?: string; title: string; artist_name: string
  artist?: { id: number; name: string; handle: string; vendor_id?: number | null }
  category_slug?: string; category_name?: string
  category?: { slug: string; name: string } | null
  categories_data?: { slug: string; name: string }[]
  vendor_id?: number | null
  vendor_slug?: string | null
  base_price: string; original_price: string | null
  regional_prices?: Record<string, { price?: string | number | null; original?: string | number | null }>
  description?: string; material?: string; processing_time_label?: string
  rating: string; review_count: number
  is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean
  allow_custom_size?: boolean
  images: { url: string; src?: string; media_type?: string }[]; tags: string[]
  sizes: ApiVariantOption[]; finishes: ApiVariantOption[]; frames: ApiVariantOption[]
  variants: ApiVariant[]
  size_variants?: SizeVariant[]
}
type RelatedProduct = { id: number; slug?: string; category_slug?: string; title: string; artist_name: string; base_price: string; image_url: string }

function ProductContactModal({
  product,
  vendorId,
  onClose,
  initialSubject,
  initialMessage,
}: {
  product: ApiProduct
  vendorId: number
  onClose: () => void
  initialSubject?: string
  initialMessage?: string
}) {
  const router = useRouter()
  const defaultMessage = initialMessage ?? "Hi, I'm interested in this product. Could you tell me more about availability, sizing, or custom options?"
  const [message, setMessage] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  async function handleSend() {
    if (!message.trim()) return
    if (!getAccessToken()) {
      router.push(`/login?next=${encodeURIComponent(productHref({ id: product.id, slug: product.slug }))}`)
      return
    }
    setSending(true)
    setError("")
    try {
      const conv = await authFetch<{ id: number }>("/messaging/conversations/", {
        method: "POST",
        body: JSON.stringify({
          subject: initialSubject ?? `Regarding "${product.title}"`,
          vendor_id: vendorId,
          product_id: product.id,
          initial_message: message.trim(),
        }),
      })
      router.push(`/inbox?conv=${conv.id}`)
    } catch {
      setError("Failed to send message. Please try again.")
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dp-border">
          <div>
            <p className="text-[13px] font-bold text-dp-text-primary">Contact Artist</p>
            <p className="text-[11px] text-dp-text-tertiary">Re: {product.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <p className="text-[12px] text-dp-text-secondary">
            Message <strong className="text-dp-text-primary">{product.artist_name}</strong> about this product.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover resize-none"
          />
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <button
            onClick={() => { void handleSend() }}
            disabled={sending || !message.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
          >
            {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Message</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main interactive product detail ──────────────────────
export default function ProductDetail({ product, categoryContext }: { product: ApiProduct; categoryContext?: string }) {
  const selfHref = productHref({ id: product.id, slug: product.slug, categorySlug: categoryContext })
  const router = useRouter()
  const { addItem } = useCart()
  const { isWishlisted, toggle: toggleWishlist } = useWishlist()
  const { formatPrice, currency, rates, detectedCountry } = useLocale()
  const formatLocalized = (amount: number | string | null | undefined) => formatAmount(amount, currency)
  const isGeoGE = detectedCountry === "GE" || currency === "GEL"
  const categorySlug = product.category_slug ?? product.category?.slug ?? ""
  const categoryName = product.category_name ?? product.category?.name ?? ""
  const artistHandle = product.artist?.handle
  const vendorId = product.vendor_id ?? product.artist?.vendor_id ?? null
  const normalizedContext = (categoryContext ?? "").toLowerCase()
  const normalizedCategory = categorySlug.toLowerCase()
  const figureSlugs = new Set(["figures", "figure"])
  const wallpanelSlugs = new Set(["wallpanels", "wallpanel", "panels", "panel"])
  const isFigure = figureSlugs.has(normalizedContext) || figureSlugs.has(normalizedCategory)
  const isWallpanel = wallpanelSlugs.has(normalizedContext) || wallpanelSlugs.has(normalizedCategory)
  const activeSizeVariants = (product.size_variants ?? []).filter((sv) => sv.is_active)
  const [selectedSizeVariantId, setSelectedSizeVariantId] = useState<number | null>(activeSizeVariants[0]?.id ?? null)
  // Legacy poster variant selectors (kept for products that still use old variant system)
  const [selectedSize,   setSelectedSize]   = useState(product.sizes?.[0]?.id ?? "")
  const [selectedFinish, setSelectedFinish] = useState(product.finishes?.[0]?.id ?? "")
  const [selectedFrame,  setSelectedFrame]  = useState(product.frames?.[0]?.id ?? "")
  const [qty,            setQty]            = useState(1)
  const [adding,         setAdding]         = useState(false)
  const [added,          setAdded]          = useState(false)
  const [addError,       setAddError]       = useState("")
  const [wishWorking,    setWishWorking]    = useState(false)
  const [activeImage,    setActiveImage]    = useState(0)
  const [related, setRelated] = useState<RelatedProduct[]>([])
  const [showContact, setShowContact] = useState(false)
  const [contactSubject, setContactSubject] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [shareCopied, setShareCopied] = useState(false)
  const [giftWrap, setGiftWrap] = useState(false)
  const [giftWrapNote, setGiftWrapNote] = useState("")
  const [giftWrapImageUrl, setGiftWrapImageUrl] = useState("")
  const [giftWrapLocalPreview, setGiftWrapLocalPreview] = useState("")
  const [giftWrapUploadError, setGiftWrapUploadError] = useState("")
  const [giftWrapImageUploading, setGiftWrapImageUploading] = useState(false)
  const giftWrapFileRef = useRef<HTMLInputElement>(null)
  const giftWrapPreviewRef = useRef<HTMLDivElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const [giftWrapPrice, setGiftWrapPrice] = useState(0)
  const [processingOption, setProcessingOption] = useState("standard")
  const [processingOptions, setProcessingOptions] = useState<ProcessingOpt[]>([])
  const [productCmsContent, setProductCmsContent] = useState<ProductCmsContent | null>(null)

  const wishlisted = isWishlisted(product.id)

  useEffect(() => {
    let cancelled = false
    apiFetch<{ results: RelatedProduct[] }>(`/products/?category=${categorySlug}&page_size=4`)
      .then((d) => { if (!cancelled) setRelated(d.results.filter((p) => p.id !== product.id).slice(0, 4)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [product.id, categorySlug])

  // Load gift wrap price (per vendor, GEL/USD)
  useEffect(() => {
    const slug = product.vendor_slug
    const url = slug ? `/orders/shop-settings/?vendor=${slug}` : "/orders/shop-settings/"
    apiFetch<Record<string, string>>(url)
      .then((d) => {
        const price = currency === "GEL"
          ? parseFloat(d.gift_wrap_price_gel ?? d.gift_wrap_price ?? "0")
          : parseFloat(d.gift_wrap_price_usd ?? d.gift_wrap_price ?? "0")
        if (price > 0) setGiftWrapPrice(price)
      })
      .catch(() => {})
  }, [product.vendor_slug, currency])

  // Load processing options for wallpanel products
  useEffect(() => {
    if (!isWallpanel) return
    const slug = product.vendor_slug ?? "panel-studio"
    apiFetch<ProcessingOpt[]>(`/orders/processing-options/?vendor=${slug}`)
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setProcessingOptions(d)
          setProcessingOption(d[0].slug)
        }
      })
      .catch(() => {})
  }, [isWallpanel])

  useEffect(() => {
    let cancelled = false
    const sectionKey = isFigure ? "figures" : isWallpanel ? "wallpanels" : "default"
    apiFetch<Array<{ section_key: string; content: Record<string, unknown> }>>("/cms/pages/product/")
      .then((sections) => {
        if (cancelled) return
        const match = sections.find((s) => s.section_key === sectionKey)
        if (match?.content) setProductCmsContent(match.content as ProductCmsContent)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isFigure, isWallpanel])

  useEffect(() => () => {
    if (giftWrapLocalPreview) URL.revokeObjectURL(giftWrapLocalPreview)
  }, [giftWrapLocalPreview])

  // New size variant system
  const selectedSizeVariant = activeSizeVariants.find((sv) => sv.id === selectedSizeVariantId) ?? null
  const hasSizeVariants = activeSizeVariants.length > 0
  const isSoldOut = selectedSizeVariant
    ? (selectedSizeVariant as unknown as { stock?: number | null }).stock === 0
    : activeSizeVariants.length > 0 && activeSizeVariants.every((sv) => (sv as unknown as { stock?: number | null }).stock === 0)

  // Thumbnails always show the full product gallery
  const thumbMedia = (product.images ?? []).map((i) => ({
    src: (i as { src?: string; url: string }).src ?? (i as { url: string }).url,
    media_type: (i as { media_type?: string }).media_type ?? "image",
    id: (i as { id?: number }).id,
  }))

  // Map: image id → variant id (first variant that owns this image wins)
  const imageVariantMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const sv of activeSizeVariants) {
      const imgs = (sv as unknown as { images?: Array<{ id: number }> }).images ?? []
      for (const img of imgs) {
        if (!map.has(img.id)) map.set(img.id, sv.id)
      }
    }
    return map
  }, [activeSizeVariants])

  function handleThumbnailClick(i: number) {
    setActiveImage(i)
    const imgId = thumbMedia[i]?.id
    if (imgId != null && imageVariantMap.has(imgId)) {
      setSelectedSizeVariantId(imageVariantMap.get(imgId)!)
    }
  }

  // When variant changes, jump to its first assigned image (or back to 0)
  useEffect(() => {
    if (!selectedSizeVariantId) { setActiveImage(0); return }
    const sv = activeSizeVariants.find((s) => s.id === selectedSizeVariantId)
    const varImgs = (sv as unknown as { images?: Array<{ id: number }> })?.images ?? []
    if (varImgs.length > 0) {
      const idx = thumbMedia.findIndex((m) => m.id === varImgs[0].id)
      setActiveImage(idx >= 0 ? idx : 0)
    } else {
      setActiveImage(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSizeVariantId])

  useEffect(() => {
    const active = thumbMedia[activeImage]
    const video = mainVideoRef.current
    if (!video) return
    if (active?.media_type === "video") {
      video.load()
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [activeImage, thumbMedia])

  // Legacy poster variant selectors
  const size    = product.sizes?.find((s) => s.id === selectedSize)
  const finish  = product.finishes?.find((f) => f.id === selectedFinish)
  const frame   = product.frames?.find((fr) => fr.id === selectedFrame)
  const surcharge = (opt?: ApiVariantOption) => Number(opt?.surcharge ?? 0)
  const variantSurcharge = surcharge(size) + surcharge(finish) + surcharge(frame)

  // Resolve geo-targeted base price
  const resolved = resolveProductPrices(
    parseFloat(product.base_price),
    product.original_price ? parseFloat(product.original_price) : null,
    product.regional_prices ?? {},
    currency,
    rates,
  )
  // If new size variant selected, use explicit regional prices (no conversion drift)
  const selectedVariantPricing = selectedSizeVariant
    ? resolveSizeVariantPrice(selectedSizeVariant, currency, rates, product.is_sale, product)
    : null
  const basePrice = selectedVariantPricing
    ? selectedVariantPricing.price
    : resolved.price + variantSurcharge
  const originalPrice = selectedVariantPricing
    ? selectedVariantPricing.original
    : (resolved.original != null ? resolved.original + variantSurcharge : null)
  const selectedProcessing = processingOptions.find((o) => o.slug === processingOption)
  const processingPrice = selectedProcessing
    ? parseFloat(currency === "GEL" ? selectedProcessing.price_gel : selectedProcessing.price_usd)
    : 0
  const price = basePrice + (giftWrap ? giftWrapPrice : 0) + processingPrice
  const discount = originalPrice != null && originalPrice > basePrice
    ? Math.round(((originalPrice - basePrice) / originalPrice) * 100)
    : null

  async function handleGiftWrapImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGiftWrapUploadError("")
    if (giftWrapLocalPreview) URL.revokeObjectURL(giftWrapLocalPreview)
    const localUrl = URL.createObjectURL(file)
    setGiftWrapLocalPreview(localUrl)
    setGiftWrapImageUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const token = getAccessToken()
      const res = await fetch(`${base}/orders/gift-wrap-upload/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (res.ok) {
        const data = await res.json() as { url: string }
        setGiftWrapImageUrl(data.url)
        URL.revokeObjectURL(localUrl)
        setGiftWrapLocalPreview("")
        requestAnimationFrame(() => {
          giftWrapPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        })
      } else {
        setGiftWrapUploadError("Upload failed. Please try again.")
      }
    } catch {
      setGiftWrapUploadError("Upload failed. Please try again.")
    } finally {
      setGiftWrapImageUploading(false)
      if (giftWrapFileRef.current) giftWrapFileRef.current.value = ""
    }
  }

  async function handleAddToCart() {
    if (!getAccessToken()) {
      router.push(`/login?next=${encodeURIComponent(selfHref)}`)
      return
    }

    // New size-variant path
    if (hasSizeVariants) {
      if (!selectedSizeVariantId) {
        setAddError("Please select a size.")
        return
      }
      setAdding(true)
      setAddError("")
      try {
        await addItem(null, qty, {
          gift_wrap: giftWrap,
          gift_wrap_note: giftWrap ? giftWrapNote : "",
          gift_wrap_image_url: giftWrap ? giftWrapImageUrl : "",
          processing_option: isWallpanel ? processingOption : "",
          size_variant_id: selectedSizeVariantId,
          currency,
        })
        setAdded(true)
        setTimeout(() => setAdded(false), 2200)
      } catch (err) {
        setAddError(getApiErrorMessage(err, "Could not add to cart. Please try again."))
      } finally {
        setAdding(false)
      }
      return
    }

    // Legacy variant path
    const variant = product.variants?.find(
      // eslint-disable-next-line eqeqeq
      (v) => v.size?.id == selectedSize && v.finish?.id == selectedFinish && v.frame?.id == selectedFrame,
    )
    if (!variant) {
      setAddError("This combination is unavailable. Please try a different option.")
      return
    }
    setAdding(true)
    setAddError("")
    try {
      await addItem(variant.id, qty, { gift_wrap: giftWrap, gift_wrap_note: giftWrap ? giftWrapNote : "", gift_wrap_image_url: giftWrap ? giftWrapImageUrl : "", processing_option: isWallpanel ? processingOption : "", currency })
      setAdded(true)
      setTimeout(() => setAdded(false), 2200)
    } catch (err) {
      setAddError(getApiErrorMessage(err, "Could not add to cart. Please try again."))
    } finally {
      setAdding(false)
    }
  }

  async function handleWishlist() {
    if (!getAccessToken()) {
      router.push(`/login?next=${encodeURIComponent(selfHref)}`)
      return
    }
    setWishWorking(true)
    try {
      await toggleWishlist(product.id)
    } finally {
      setWishWorking(false)
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const shareData = { title: product.title, text: `Check out ${product.title} by ${product.artist_name}`, url }
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData)
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <SiteShell>
      <div className="dp-container py-4">
        <Breadcrumb items={product.breadcrumbs ?? [
          { name: "Home", url: "/" },
          { name: "Shop", url: "/catalog" },
          ...(categorySlug && categoryName ? [{ name: categoryName, url: `/catalog?category=${categorySlug}` }] : []),
          { name: product.title, url: `/catalog/${product.slug}` },
        ]} />
        <Link href="/catalog" className="md:hidden inline-flex items-center gap-1 mt-3 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
          <ChevronLeft size={13} /> Back to catalog
        </Link>
      </div>

      {/* ── Main product section ──────────────────────────── */}
      <div className="dp-container pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">

          {/* Left: image gallery */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-dp-bg-elevated">
              {thumbMedia.length > 0 && thumbMedia[activeImage]?.media_type === "video" ? (
                <video
                  ref={mainVideoRef}
                  key={thumbMedia[activeImage].src}
                  src={thumbMedia[activeImage].src}
                  muted
                  loop
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              ) : thumbMedia.length > 0 ? (
              <Image
                  src={thumbMedia[activeImage]?.src || ""}
                alt={product.title}
                fill
                className="object-cover transition-opacity duration-300"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority={activeImage === 0}
              />
              ) : null}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.is_limited   && <span className="badge-limited">Limited</span>}
                {product.is_sale && discount && <span className="badge-sale">-{discount}%</span>}
                {product.is_new       && <span className="badge-limited" style={{ background: "var(--dp-success)", color: "#fff" }}>New</span>}
                {product.is_exclusive && <span className="badge-limited" style={{ background: "var(--dp-accent-gold)", color: "#111" }}>Exclusive</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {thumbMedia.map((media, i) => (
                <button
                  key={i}
                  onClick={() => handleThumbnailClick(i)}
                  className={`relative w-16 h-20 rounded-md overflow-hidden border-2 transition-colors ${activeImage === i ? "border-dp-accent-cta" : "border-dp-border hover:border-dp-border-hover"}`}
                  aria-label={`View item ${i + 1}`}
                  aria-pressed={activeImage === i}
                >
                  {media.media_type === "video" ? (
                    <video
                      src={media.src}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <Image src={media.src} alt="" fill className="object-cover" sizes="64px" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: details */}
          <div className="flex flex-col gap-5">
            <Link href="/catalog" className="hidden md:inline-flex items-center gap-1 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors w-fit">
              <ChevronLeft size={13} /> Back to catalog
            </Link>

            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary">
              by{" "}
              {artistHandle ? (
                <Link href={`/artists/${artistHandle}`} className="hover:text-dp-accent-cta transition-colors">
                  {product.artist_name}
                </Link>
              ) : (
                <Link href={`/catalog?q=${encodeURIComponent(product.artist_name)}`} className="hover:text-dp-accent-cta transition-colors">
                  {product.artist_name}
                </Link>
              )}
            </p>

            <h1 className="font-display text-4xl lg:text-5xl text-dp-text-primary leading-tight">
              {product.title}
            </h1>

            <div className="flex items-baseline gap-3">
              <span className={`font-display text-4xl ${originalPrice != null && originalPrice > basePrice ? "text-dp-accent-cta" : "text-dp-text-primary"}`}>
                {formatLocalized(price)}
              </span>
              {originalPrice != null && originalPrice > basePrice && (
                <span className="text-lg text-dp-text-tertiary line-through">
                  {formatLocalized(originalPrice + (giftWrap ? giftWrapPrice : 0) + processingPrice)}
                </span>
              )}
              {discount != null && discount > 0 && <span className="text-sm font-bold text-dp-accent-cta">Save {discount}%</span>}
            </div>

            <p className="text-[14px] text-dp-text-secondary leading-relaxed whitespace-pre-wrap">
              {product.description
                ? product.description
                : `A high-quality metal print featuring ${product.title} by ${product.artist_name}. Printed on durable, damage-resistant aluminium with vibrant, UV-stable inks. Comes with our tool-free magnetic mounting system — hang it in seconds, rearrange anytime.`}
            </p>

            {product.material && (
              <p className="text-[12px] text-dp-text-tertiary">
                <span className="font-bold uppercase tracking-widest">Material:</span> {product.material}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {(product.tags ?? []).map((tag) => (
                <Link key={tag} href={`/catalog?tag=${tag}`}
                  className="px-3 py-1 text-[11px] font-semibold uppercase tracking-widest border border-dp-border rounded-full text-dp-text-tertiary hover:border-dp-border-hover hover:text-dp-text-secondary transition-colors">
                  {tag}
                </Link>
              ))}
            </div>

            {/* New size variants selector — card style */}
            {hasSizeVariants && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2.5">Select Size</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {activeSizeVariants.map((sv) => {
                    const svResolved = resolveSizeVariantPrice(sv, currency, rates, product.is_sale, product)
                    const isSelected = selectedSizeVariantId === sv.id
                    const onVariantSale = svResolved.original != null && svResolved.original > svResolved.price
                    return (
                      <button
                        key={sv.id}
                        onClick={() => setSelectedSizeVariantId(sv.id)}
                        aria-pressed={isSelected}
                        className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-3 rounded-sm border-2 transition-all duration-150 ${
                          isSelected
                            ? "border-dp-accent-cta bg-dp-accent-cta/8 shadow-sm shadow-dp-accent-cta/20"
                            : "border-dp-border bg-dp-bg-elevated hover:border-dp-border-hover hover:bg-dp-bg-surface"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-dp-accent-cta flex items-center justify-center">
                            <Check size={8} className="text-white" strokeWidth={3} />
                          </span>
                        )}
                        <span className={`text-[12px] font-bold leading-tight ${isSelected ? "text-dp-accent-cta" : "text-dp-text-primary"}`}>
                          {sv.label}
                        </span>
                        <span className={`text-[13px] font-black tabular-nums ${
                          onVariantSale
                            ? "text-dp-accent-cta"
                            : isSelected
                              ? "text-dp-text-primary"
                              : "text-dp-text-secondary"
                        }`}>
                          {formatLocalized(svResolved.price)}
                        </span>
                        {onVariantSale && (
                          <span className="text-[10px] text-dp-text-tertiary line-through tabular-nums">
                            {formatLocalized(svResolved.original!)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Legacy variant selectors for products without size_variants */}
            {!hasSizeVariants && (product.sizes?.length ?? 0) > 0 && <VariantSelector label="Size" options={product.sizes} selected={selectedSize} onSelect={setSelectedSize} />}
            {!hasSizeVariants && (product.finishes?.length ?? 0) > 0 && <VariantSelector label="Finish" options={product.finishes} selected={selectedFinish} onSelect={setSelectedFinish} />}
            {!hasSizeVariants && (product.frames?.length ?? 0) > 0 && <VariantSelector label="Frame" options={product.frames} selected={selectedFrame} onSelect={setSelectedFrame} />}

            {/* Contact for custom size — eye-catching banner */}
            {product.allow_custom_size && vendorId && (
              <button
                onClick={() => {
                  setContactSubject(`Request for custom size — ${product.title}`)
                  setContactMessage(`Hi, I'm interested in a custom size for "${product.title}". Could you let me know what options are available and the pricing?\n\nThank you!`)
                  if (!getAccessToken()) {
                    router.push(`/login?next=${encodeURIComponent(selfHref)}`)
                    return
                  }
                  setShowContact(true)
                }}
                className="group relative overflow-hidden flex items-center justify-between gap-3 w-full px-4 py-3.5 rounded-sm border border-dp-accent-cta/40 bg-dp-accent-cta/5 hover:bg-dp-accent-cta/10 hover:border-dp-accent-cta transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-dp-accent-cta/15 text-dp-accent-cta shrink-0">
                    <Sparkles size={15} />
                  </span>
                  <div className="text-left">
                    <p className="text-[13px] font-bold text-dp-text-primary leading-tight">Need a different size?</p>
                    <p className="text-[11px] text-dp-text-tertiary mt-0.5">Contact us — we&apos;ll quote a custom size just for you</p>
                  </div>
                </div>
                <ArrowRight size={15} className="text-dp-accent-cta shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {/* Processing time selector — shown for any product with options configured */}
            {processingOptions.length > 0 && (
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">Processing Time</p>
                <div className="flex flex-col gap-2">
                  {processingOptions.map((opt) => {
                    const optPrice = parseFloat(currency === "GEL" ? opt.price_gel : opt.price_usd)
                    return (
                      <label
                        key={opt.slug}
                        className={`flex items-center justify-between gap-3 px-4 py-3 border rounded-sm cursor-pointer transition-colors ${
                          processingOption === opt.slug
                            ? "border-dp-accent-cta bg-dp-accent-cta/5"
                            : "border-dp-border hover:border-dp-border-hover"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="processing"
                            value={opt.slug}
                            checked={processingOption === opt.slug}
                            onChange={() => setProcessingOption(opt.slug)}
                            className="accent-dp-accent-cta"
                          />
                          <div>
                            <p className="text-[13px] font-semibold text-dp-text-primary">{opt.label}</p>
                            <p className="text-[11px] text-dp-text-tertiary">{opt.est_days_min}–{opt.est_days_max} business days to build</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-bold text-dp-text-primary">
                          {optPrice === 0 ? "Included" : `+${formatLocalized(optPrice)}`}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Processing time — fallback static display when no selectable options exist */}
            {processingOptions.length === 0 && (isFigure || product.processing_time_label) && (
              <div className="flex items-center gap-3 px-4 py-3 border border-dp-border rounded-sm bg-dp-bg-elevated/40">
                <Clock size={15} className="text-dp-accent-cta shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-dp-text-primary">
                    Processing Time: {product.processing_time_label || "20–25 business days"}
                  </p>
                  <p className="text-[11px] text-dp-text-tertiary mt-0.5">Each figure is hand-crafted and made to order</p>
                </div>
              </div>
            )}

            {/* Gift wrap toggle */}
            {giftWrapPrice > 0 && (
              <div className={`border rounded-sm transition-colors ${giftWrap ? "border-dp-accent-cta/50 bg-dp-accent-cta/5" : "border-dp-border"}`}>
                <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-dp-bg-elevated/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Gift size={16} className="text-dp-text-tertiary shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-dp-text-primary">Add gift wrapping</p>
                      <p className="text-[11px] text-dp-text-tertiary">Beautifully wrapped — add engraving text below</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-dp-text-primary">+{formatPrice(giftWrapPrice)}</span>
                    <input
                      type="checkbox"
                      checked={giftWrap}
                      onChange={(e) => setGiftWrap(e.target.checked)}
                      className="w-4 h-4 accent-dp-accent-cta"
                    />
                  </div>
                </label>
                {giftWrap && (
                  <div className="px-4 pb-3 flex flex-col gap-2.5 border-t border-dp-accent-cta/20">
                    <p className="text-[11px] font-semibold text-dp-text-secondary pt-2">Engraving / personalisation</p>

                    {/* Image upload */}
                    <div>
                      <p className="text-[10px] text-dp-text-tertiary mb-1.5">Upload engraving design image (optional)</p>
                      {giftWrapUploadError && <p className="text-[11px] text-dp-accent-cta mb-1.5">{giftWrapUploadError}</p>}
                      {(giftWrapImageUrl || giftWrapLocalPreview) ? (
                        <div ref={giftWrapPreviewRef} className="flex items-center gap-2">
                          <div className="w-16 h-16 rounded-sm overflow-hidden border border-dp-accent-cta/40 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={giftWrapImageUrl || giftWrapLocalPreview} alt="Engraving preview" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] text-dp-text-secondary">
                              {giftWrapImageUploading ? "Uploading…" : giftWrapImageUrl ? "Image uploaded ✓" : "Preview ready — uploading…"}
                            </span>
                            <button type="button" onClick={() => {
                              if (giftWrapLocalPreview) URL.revokeObjectURL(giftWrapLocalPreview)
                              setGiftWrapLocalPreview("")
                              setGiftWrapImageUrl("")
                            }}
                              className="text-[10px] text-red-400 hover:underline text-left">Remove</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => giftWrapFileRef.current?.click()}
                          disabled={giftWrapImageUploading}
                          className="flex items-center gap-2 px-3 py-2 border border-dashed border-dp-border hover:border-dp-accent-cta/50 rounded-sm text-[11px] text-dp-text-tertiary hover:text-dp-text-secondary transition-colors disabled:opacity-50"
                        >
                          {giftWrapImageUploading
                            ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                            : <><Upload size={13} /> <ImageIcon size={13} /> Upload image</>}
                        </button>
                      )}
                      <input
                        ref={giftWrapFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleGiftWrapImageUpload(e)}
                      />
                    </div>

                    {/* Text note */}
                    <textarea
                      rows={2}
                      value={giftWrapNote}
                      onChange={(e) => setGiftWrapNote(e.target.value)}
                      placeholder="Write the text you want engraved on the box (optional)…"
                      className="w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-accent-cta/50 transition-colors resize-none"
                    />
                    <p className="text-[10px] text-dp-text-tertiary">Both the image and text will be visible to our team in the order details.</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-stretch gap-2 w-full sm:flex-1 sm:min-w-0">
                <div className="flex items-center border border-dp-border rounded-sm overflow-hidden shrink-0">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2.5 text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors" aria-label="Decrease quantity">−</button>
                <span className="px-4 py-2.5 text-[14px] font-bold text-dp-text-primary min-w-[3rem] text-center tabular-nums">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2.5 text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors" aria-label="Increase quantity">+</button>
              </div>
              <button
                onClick={() => { if (!isSoldOut) void handleAddToCart() }}
                disabled={adding || isSoldOut}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-3 rounded-sm text-[11px] sm:text-[13px] font-black uppercase tracking-widest transition-colors disabled:opacity-60 ${
                  isSoldOut
                    ? "bg-dp-bg-elevated border border-dp-border text-dp-text-tertiary cursor-not-allowed"
                    : added
                      ? "bg-dp-success text-white"
                      : "bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white"
                }`}
              >
                {isSoldOut
                    ? <span className="truncate">Sold Out</span>
                  : adding
                    ? <><Loader2 size={16} className="animate-spin shrink-0" /> <span className="truncate">Adding…</span></>
                    : added
                        ? <><Check size={16} className="shrink-0" /> <span className="truncate">Added to Cart</span></>
                        : <><ShoppingCart size={16} className="shrink-0" /> <span className="truncate">Add to Cart — {formatLocalized(price * qty)}</span></>}
              </button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">
              <button
                onClick={() => { void handleWishlist() }}
                disabled={wishWorking}
                className={`flex-1 sm:flex-none p-3 border rounded-sm transition-colors disabled:opacity-60 flex items-center justify-center ${
                  wishlisted
                    ? "border-dp-accent-cta text-dp-accent-cta bg-dp-accent-cta/10"
                    : "border-dp-border text-dp-text-secondary hover:text-dp-accent-cta hover:border-dp-accent-cta"
                }`}
                aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                {wishWorking
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Heart size={16} className={wishlisted ? "fill-dp-accent-cta" : ""} />}
              </button>
              <button
                onClick={() => { void handleShare() }}
                className="flex-1 sm:flex-none p-3 border border-dp-border rounded-sm text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors flex items-center justify-center"
                aria-label={shareCopied ? "Link copied" : "Share this product"}
                title={shareCopied ? "Link copied!" : "Share"}
              >
                <Share2 size={16} />
              </button>
              </div>
            </div>

            {vendorId && (
              <button
                onClick={() => {
                  if (!getAccessToken()) {
                    router.push(`/login?next=${encodeURIComponent(selfHref)}`)
                    return
                  }
                  setContactSubject("")
                  setContactMessage("")
                  setShowContact(true)
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-dp-border rounded-sm text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
              >
                <MessageSquare size={14} /> Contact Artist regarding this product
              </button>
            )}

            {addError && (
              <p className="text-[12px] text-red-500 -mt-1">{addError}</p>
            )}

            {(product as {is_ready_to_ship?: boolean}).is_ready_to_ship ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-sm">
                <PackageCheck size={14} className="text-emerald-500 shrink-0" />
                <p className="text-[12px] font-semibold text-emerald-500">Ready to ship — ships within 5–10 business days.</p>
              </div>
            ) : product.is_limited && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-dp-accent-gold/10 border border-dp-accent-gold/30 rounded-sm">
                <Clock size={14} className="text-dp-accent-gold shrink-0" />
                <p className="text-[12px] font-semibold text-dp-accent-gold">Limited edition — only a few remaining at this price.</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-dp-border">
              {[
                { icon: <Truck size={16} />,     text: `Free shipping over ${formatPrice(49)}` },
                { icon: <Shield size={16} />,    text: "100-day money-back" },
                { icon: <RotateCcw size={16} />, text: "Tool-free mounting" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex flex-col items-center gap-1.5 text-center">
                  <span className="text-dp-text-tertiary">{icon}</span>
                  <p className="text-[11px] text-dp-text-tertiary leading-tight">{text}</p>
                </div>
              ))}
            </div>

            <div className="border border-dp-border rounded-sm px-4 mt-1">
              <AccordionItem title="Product Details">
                {isFigure ? (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Premium metal figure print with crisp edge definition</li>
                    <li>UV-resistant inks preserve colour and detail for years</li>
                    <li>Lightweight aluminium — easy to display on shelves or walls</li>
                    <li>Scratch-resistant finish built for collectors</li>
                  </ul>
                ) : isWallpanel ? (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Printed on 0.045&quot; thick aluminium composite</li>
                    <li>UV-resistant, fade-proof inks — no frame needed</li>
                    <li>Comes with 4 magnetic mounting pins, no tools required</li>
                    <li>Scratch and moisture resistant surface</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Printed on 0.045&quot; thick aluminium composite</li>
                    <li>UV-resistant, fade-proof inks — no frame needed</li>
                    <li>Comes with 4 magnetic mounting pins, no tools required</li>
                    <li>Scratch and moisture resistant surface</li>
                    <li>Made to order — produced within 3 business days</li>
                  </ul>
                )}
              </AccordionItem>

              {/* Figure-specific processing & shipping */}
              {isFigure && (
                <AccordionItem title="Processing Time & Shipping">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Clock size={14} className="text-dp-accent-cta shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-dp-text-primary">Processing time: 20–25 business days</p>
                        <p className="text-dp-text-tertiary text-[11px] mt-0.5">Each figure is hand-crafted and made to order.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Truck size={14} className="text-dp-text-tertiary shrink-0 mt-0.5" />
                      <div className="space-y-1.5 w-full">
                        <div className="flex justify-between">
                          <span className="font-semibold text-dp-text-primary">Standard delivery</span>
                          <span className="text-dp-text-secondary">approx. 2 weeks</span>
                          <span className="text-emerald-400 font-bold text-[11px]">FREE</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-dp-text-primary">Express delivery</span>
                          <span className="text-dp-text-secondary">approx. 1 week</span>
                          <span className="font-bold text-dp-text-primary">+$35</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionItem>
              )}

              {/* Wallpanel-specific delivery */}
              {isWallpanel && (
                <AccordionItem title="Delivery Information">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Truck size={14} className="text-dp-accent-cta shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-dp-text-primary">Georgia 🇬🇪</p>
                        <p className="text-dp-text-secondary text-[12px]">Within Tbilisi: 1–2 days</p>
                        <p className="text-dp-text-secondary text-[12px]">Regions: 1–3 days</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Truck size={14} className="text-dp-text-tertiary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-dp-text-primary">International</p>
                        <p className="text-dp-text-secondary text-[12px]">Approx. 2 weeks worldwide</p>
                      </div>
                    </div>
                  </div>
                </AccordionItem>
              )}

              {/* Generic shipping for non-figure, non-wallpanel */}
              {!isFigure && !isWallpanel && (
              <AccordionItem title="Shipping & Returns">
                Free standard shipping on orders over {formatPrice(49)}. Estimated delivery 5–8 business days.
                Not happy? Return within 100 days for a full refund — no questions asked.
              </AccordionItem>
              )}
            </div>
          </div>
        </div>
      </div>

      {productCmsContent?.blocks?.length ? (
        <ProductCmsSections content={productCmsContent} />
      ) : isFigure ? (
        <>
          <section className="border-y border-dp-border bg-dp-bg-elevated py-14" aria-labelledby="figures-craft-heading">
            <div className="dp-container">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">Figure Studio</p>
                <h2 id="figures-craft-heading" className="font-display text-4xl md:text-5xl text-dp-text-primary mb-4 leading-tight">
                  Sculpted Detail.<br />Built to Collect.
                  </h2>
                <p className="text-[14px] text-dp-text-secondary leading-relaxed">
                  Each figure is produced as a precision metal piece — crisp silhouettes, rich surface depth,
                  and colour that holds up on shelves, desks, and in display cases year after year.
                </p>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: <Layers size={22} />, title: "Layered Depth", desc: "UV metal printing brings out contours, shadows, and linework that flat prints flatten out." },
                  { icon: <Palette size={22} />, title: "Finish Options", desc: "Matte, gloss, or satin coatings let you match the look of your collection or display setup." },
                  { icon: <Box size={22} />, title: "Collector Packaging", desc: "Ships protected and display-ready — ideal for gifting, unboxing, and long-term storage." },
                  ].map(({ icon, title, desc }) => (
                  <div key={title} className="p-6 bg-dp-bg-surface border border-dp-border rounded-sm">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-dp-accent-cta/10 text-dp-accent-cta mb-4">{icon}</span>
                    <h3 className="text-[15px] font-bold text-dp-text-primary mb-2">{title}</h3>
                    <p className="text-[13px] text-dp-text-secondary leading-relaxed">{desc}</p>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          <section className="dp-container py-16" aria-labelledby="figures-display-heading">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">Display Your Way</p>
                <h2 id="figures-display-heading" className="font-display text-3xl md:text-4xl text-dp-text-primary mb-4 leading-tight">
                  Made for Shelves,<br />Desks &amp; Galleries
            </h2>
                <p className="text-[14px] text-dp-text-secondary leading-relaxed mb-6">
                  Figures aren&apos;t just wall art — they&apos;re objects meant to be lived with.
                  Lean one on a bookshelf, line up a series on a desk, or build a curated collector wall.
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Shelf lineup", detail: "Lightweight metal — easy to rearrange without heavy bases." },
                    { label: "Desk centerpiece", detail: "Compact sizes that hold attention without dominating the space." },
                    { label: "Framed display", detail: "Optional framing for premium presentation and dust protection." },
                  ].map(({ label, detail }) => (
                    <div key={label} className="flex gap-3 p-4 bg-dp-bg-surface border border-dp-border rounded-sm">
                      <Check size={16} className="text-dp-success shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13px] font-bold text-dp-text-primary">{label}</p>
                        <p className="text-[12px] text-dp-text-secondary mt-0.5">{detail}</p>
                      </div>
                </div>
              ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <Package size={24} />, label: "Shelf Display" },
                  { icon: <Award size={24} />, label: "Limited Editions" },
                  { icon: <Sparkles size={24} />, label: "Vivid Colour" },
                  { icon: <Shield size={24} />, label: "Durable Metal" },
                ].map(({ icon, label }) => (
                  <div key={label} className="aspect-[4/5] bg-dp-bg-surface border border-dp-border rounded-sm flex flex-col items-center justify-center gap-3 p-4 text-center">
                    <span className="text-dp-accent-cta">{icon}</span>
                    <p className="text-[12px] font-bold uppercase tracking-widest text-dp-text-secondary">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-dp-text-primary text-white py-14" aria-labelledby="figures-custom-heading">
            <div className="dp-container flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">Custom Commissions</p>
                <h2 id="figures-custom-heading" className="font-display text-3xl md:text-4xl mb-4 leading-tight">
                  Want Something One of a Kind?
                </h2>
                <p className="text-white/70 text-[14px] leading-relaxed">
                  Figure Studio accepts custom references — characters, portraits, or original concepts —
                  and turns them into a bespoke metal figure made to your chosen size and finish.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Link href="/catalog?category=figures" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/20 hover:border-white/40 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
                  Shop Figures <ArrowRight size={14} />
                </Link>
                <Link href="/custom" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
                  Commission a Figure <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </section>
        </>
      ) : isWallpanel ? (
        <>
      {/* ── WHY METAL PRINTS ────────────────────────────────── */}
      <section className="bg-dp-text-primary text-white py-16" aria-labelledby="metal-heading">
        <div className="dp-container">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">Why Metal?</p>
              <h2 id="metal-heading" className="font-display text-4xl md:text-5xl mb-4 leading-tight text-white">
                Art That Looks<br />Alive on Your Wall
              </h2>
              <p className="text-white/70 text-[14px] leading-relaxed max-w-md mb-6">
                Metal prints capture light differently than paper or canvas — colours pop with a luminous depth you have to see to believe.
                No glass glare, no warping, and built to last decades.
              </p>
              <Link href="/catalog" className="inline-flex items-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
                Shop All Metal Prints <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 flex-1 w-full max-w-sm">
              {[
                { icon: <Sparkles size={20} />, title: "Vivid Colours",      desc: "Printed directly onto aluminium for impossible depth." },
                { icon: <Zap size={20} />,      title: "Tool-Free Hang",     desc: "Magnetic pins included — no drills, no damage." },
                { icon: <Shield size={20} />,   title: "Scratch-Proof",      desc: "Durable UV-stable coating protects for decades." },
                { icon: <Award size={20} />,    title: "100-Day Guarantee",  desc: "Love it or return it — no questions asked." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="p-4 border border-white/10 rounded-sm hover:border-white/20 transition-colors">
                  <span className="text-dp-accent-cta mb-2 block">{icon}</span>
                  <p className="text-[13px] font-bold text-white mb-1">{title}</p>
                  <p className="text-[12px] text-white/60 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section className="dp-container py-16" aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-display text-3xl md:text-4xl text-dp-text-primary text-center mb-10">
          From Click to Wall in 3 Steps
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Choose Your Art",  desc: "Pick from 2.5 million designs, select your size, finish, and optional frame." },
            { step: "02", title: "We Print & Ship",  desc: "Your print is produced within 3 business days and shipped with care worldwide." },
            { step: "03", title: "Hang in Seconds",  desc: "Attach the magnetic pins, click your print in place. No tools. No holes." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center gap-4 p-6 bg-dp-bg-surface border border-dp-border rounded-sm">
              <span className="font-display text-6xl text-dp-accent-cta/20 leading-none">{step}</span>
              <h3 className="font-display text-2xl text-dp-text-primary">{title}</h3>
              <p className="text-[13px] text-dp-text-secondary leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MAGNETIC MOUNTING ─────────────────────────────── */}
      <section className="bg-dp-bg-elevated py-12" aria-label="Mounting system">
        <div className="dp-container flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-full">
              <Zap size={12} className="text-dp-accent-cta" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta">Included Free</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-dp-text-primary leading-tight">
              Tool-Free Magnetic Mounting
            </h2>
            <p className="text-[14px] text-dp-text-secondary leading-relaxed max-w-md">
              Every order ships with 4 discreet magnetic mounting pins. Press them into your wall,
              click your poster in — done in under 30 seconds. Rearrange your gallery as often as you like.
            </p>
            <ul className="flex flex-col gap-2">
              {["No drilling required", "Removable — leaves walls pristine", "Repositionable in seconds", "Supports up to 15 lbs"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-dp-text-secondary">
                  <Check size={14} className="text-dp-success shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 w-full max-w-xs">
            {[Package, Truck, Shield, RotateCcw].map((Icon, i) => (
              <div key={i} className="aspect-square bg-dp-bg-surface border border-dp-border rounded-sm flex items-center justify-center">
                <Icon size={28} className="text-dp-text-tertiary" />
              </div>
            ))}
          </div>
        </div>
      </section>
        </>
      ) : null}

      {/* ── STRONG CTA BAND ────────────────────────────────── */}
      <section className="bg-dp-accent-cta py-10" aria-label="Add to cart CTA">
        <div className="dp-container flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-3xl md:text-4xl text-white leading-tight">
              {isFigure ? "Ready to Grow Your Collection?" : "Ready to Transform Your Space?"}
            </h2>
            <p className="text-white/80 text-[13px] mt-1">
              {isFigure
                ? `Collector-grade metal figures · Ships in 3 days · 100-day returns`
                : `Free shipping over ${formatPrice(49)} · 100-day returns · Ships in 3 days`}
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            className={`w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 sm:px-8 py-4 rounded-sm text-[12px] sm:text-[13px] font-black uppercase tracking-widest transition-colors ${
              added ? "bg-dp-success text-white" : "bg-white text-dp-accent-cta hover:bg-dp-bg-elevated"
            }`}
          >
            {added
              ? <><Check size={16} className="shrink-0" /> Added!</>
              : <><ShoppingCart size={16} className="shrink-0" /> <span className="truncate">Add to Cart — {formatLocalized(price * qty)}</span></>}
          </button>
        </div>
      </section>

      {/* ── RELATED PRODUCTS ───────────────────────────────── */}
      {related.length > 0 && (
        <section className="dp-container py-16" aria-labelledby="related-heading">
          <div className="flex items-end justify-between mb-6">
            <h2 id="related-heading" className="font-display text-3xl md:text-4xl text-dp-text-primary">
              More from {categoryName || "this collection"}
            </h2>
            <Link href={`/catalog?category=${categorySlug}`} className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((p) => (
              <Link key={p.id} href={productHref({ id: p.id, slug: p.slug, categorySlug: p.category_slug })} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover">
                <div className="aspect-poster relative bg-dp-bg-elevated overflow-hidden">
                  {p.image_url && <Image src={p.image_url} alt={p.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 25vw" />}
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-dp-text-tertiary truncate">{p.artist_name}</p>
                  <p className="text-[13px] font-semibold text-dp-text-primary truncate mt-0.5">{p.title}</p>
                  <p className="text-[14px] font-bold text-dp-text-primary mt-1">{formatPrice(parseFloat(p.base_price))}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── NEWSLETTER CTA ──────────────────────────────────── */}
      <section className="dp-container py-16 text-center" aria-label="Newsletter signup">
        <div className="max-w-xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">Stay in the Loop</p>
          <h2 className="font-display text-4xl text-dp-text-primary mb-3">
            New drops. Exclusive deals.<br />Artist spotlights.
          </h2>
          <p className="text-[13px] text-dp-text-secondary mb-6">
            Join 180,000+ collectors and be the first to know when new art goes live.
          </p>
          <form className="flex gap-2 max-w-sm mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>

      {showContact && vendorId && (
        <ProductContactModal
          product={product}
          vendorId={vendorId}
          onClose={() => setShowContact(false)}
          initialSubject={contactSubject || undefined}
          initialMessage={contactMessage || undefined}
        />
      )}
    </SiteShell>
  )
}
