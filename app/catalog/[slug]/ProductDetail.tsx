"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import { apiFetch, authFetch } from "@/lib/api"
import { useCart } from "@/contexts/cart-context"
import { useWishlist } from "@/contexts/wishlist-context"
import { useLocale } from "@/contexts/locale-context"
import { getAccessToken } from "@/lib/auth-storage"
import { savePendingCartIntent } from "@/lib/pending-cart"
import { productHref } from "@/lib/product-url"
import {
  ChevronLeft, ShoppingCart, Heart, Share2, Shield, Truck,
  RotateCcw, Check, Zap, ArrowRight, Award, Package,
  Sparkles, Clock, ChevronDown, ChevronUp, Loader2,
  MessageSquare, X, Send, Layers, Box, Palette,
} from "lucide-react"

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
type ApiProduct = {
  id: number; slug?: string; title: string; artist_name: string
  artist?: { id: number; name: string; handle: string; vendor_id?: number | null }
  category_slug?: string; category_name?: string
  category?: { slug: string; name: string } | null
  vendor_id?: number | null
  base_price: string; original_price: string | null; rating: string; review_count: number
  is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean
  images: { url: string }[]; tags: string[]
  sizes: ApiVariantOption[]; finishes: ApiVariantOption[]; frames: ApiVariantOption[]
  variants: ApiVariant[]
}
type RelatedProduct = { id: number; slug?: string; category_slug?: string; title: string; artist_name: string; base_price: string; image_url: string }

function ProductContactModal({
  product,
  vendorId,
  onClose,
}: {
  product: ApiProduct
  vendorId: number
  onClose: () => void
}) {
  const router = useRouter()
  const defaultMessage = "Hi, I'm interested in this product. Could you tell me more about availability, sizing, or custom options?"
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
          subject: `Regarding "${product.title}"`,
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
  const { formatPrice } = useLocale()
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
  const [shareCopied, setShareCopied] = useState(false)

  const wishlisted = isWishlisted(product.id)

  useEffect(() => {
    let cancelled = false
    apiFetch<{ results: RelatedProduct[] }>(`/products/?category=${categorySlug}&page_size=4`)
      .then((d) => { if (!cancelled) setRelated(d.results.filter((p) => p.id !== product.id).slice(0, 4)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [product.id, categorySlug])

  const size    = product.sizes?.find((s) => s.id === selectedSize)
  const finish  = product.finishes?.find((f) => f.id === selectedFinish)
  const frame   = product.frames?.find((fr) => fr.id === selectedFrame)
  const surcharge = (opt?: ApiVariantOption) => Number(opt?.surcharge ?? 0)
  const basePrice = parseFloat(product.base_price)
  const price   = basePrice + surcharge(size) + surcharge(finish) + surcharge(frame)
  const discount = product.original_price
    ? Math.round(((parseFloat(product.original_price) - basePrice) / parseFloat(product.original_price)) * 100)
    : null

  async function handleAddToCart() {
    const variant = product.variants?.find(
      // eslint-disable-next-line eqeqeq
      (v) => v.size?.id == selectedSize && v.finish?.id == selectedFinish && v.frame?.id == selectedFrame,
    )

    if (!getAccessToken()) {
      if (variant) {
        savePendingCartIntent({
          variantId: variant.id,
          quantity: qty,
          returnTo: selfHref,
        })
      }
      router.push(`/login?next=${encodeURIComponent(selfHref)}`)
      return
    }

    if (!variant) {
      setAddError("This combination is unavailable. Please try a different option.")
      return
    }

    setAdding(true)
    setAddError("")
    try {
      await addItem(variant.id, qty)
      setAdded(true)
      setTimeout(() => setAdded(false), 2200)
    } catch {
      setAddError("Could not add to cart. Please try again.")
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

  const thumbImages = product.images?.length ? product.images.map((i) => i.url) : []

  return (
    <SiteShell>
      {/* Breadcrumb */}
      <div className="dp-container py-4">
        <nav className="flex items-center gap-2 text-[12px] text-dp-text-tertiary" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-dp-text-primary transition-colors">Home</Link>
          <span>/</span>
          <Link href="/catalog" className="hover:text-dp-text-primary transition-colors">Shop</Link>
          {categorySlug && categoryName && (
            <>
              <span>/</span>
              <Link href={`/catalog?category=${categorySlug}`} className="hover:text-dp-text-primary transition-colors capitalize">{categoryName}</Link>
            </>
          )}
          <span>/</span>
          <span className="text-dp-text-primary">{product.title}</span>
        </nav>
      </div>

      {/* ── Main product section ──────────────────────────── */}
      <div className="dp-container pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">

          {/* Left: image gallery */}
          <div className="space-y-3">
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-dp-bg-elevated">
              <Image
                src={thumbImages[activeImage]}
                alt={product.title}
                fill
                className="object-cover transition-opacity duration-300"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.is_limited   && <span className="badge-limited">Limited</span>}
                {product.is_sale && discount && <span className="badge-sale">-{discount}%</span>}
                {product.is_new       && <span className="badge-limited" style={{ background: "var(--dp-success)", color: "#fff" }}>New</span>}
                {product.is_exclusive && <span className="badge-limited" style={{ background: "var(--dp-accent-gold)", color: "#111" }}>Exclusive</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {thumbImages.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`relative w-16 h-20 rounded-md overflow-hidden border-2 transition-colors ${activeImage === i ? "border-dp-accent-cta" : "border-dp-border hover:border-dp-border-hover"}`}
                  aria-label={`View angle ${i + 1}`}
                  aria-pressed={activeImage === i}
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          </div>

          {/* Right: details */}
          <div className="flex flex-col gap-5">
            <Link href="/catalog" className="inline-flex items-center gap-1 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors w-fit">
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
              <span className="font-display text-4xl text-dp-text-primary">{formatPrice(price)}</span>
              {product.original_price && (
                <span className="text-lg text-dp-text-tertiary line-through">
                  {formatPrice(parseFloat(product.original_price) + surcharge(size) + surcharge(finish) + surcharge(frame))}
                </span>
              )}
              {discount && <span className="text-sm font-bold text-dp-accent-cta">Save {discount}%</span>}
            </div>

            <p className="text-[14px] text-dp-text-secondary leading-relaxed">
              A high-quality metal print featuring <strong className="text-dp-text-primary">{product.title}</strong> by {product.artist_name}.
              Printed on durable, damage-resistant aluminium with vibrant, UV-stable inks.
              Comes with our tool-free magnetic mounting system — hang it in seconds, rearrange anytime.
            </p>

            <div className="flex flex-wrap gap-2">
              {(product.tags ?? []).map((tag) => (
                <Link key={tag} href={`/catalog?tag=${tag}`}
                  className="px-3 py-1 text-[11px] font-semibold uppercase tracking-widest border border-dp-border rounded-full text-dp-text-tertiary hover:border-dp-border-hover hover:text-dp-text-secondary transition-colors">
                  {tag}
                </Link>
              ))}
            </div>

            {(product.sizes?.length ?? 0) > 0 && <VariantSelector label="Size"   options={product.sizes}    selected={selectedSize}   onSelect={setSelectedSize} />}
            {(product.finishes?.length ?? 0) > 0 && <VariantSelector label="Finish" options={product.finishes} selected={selectedFinish} onSelect={setSelectedFinish} />}
            {(product.frames?.length ?? 0) > 0 && <VariantSelector label="Frame"  options={product.frames}   selected={selectedFrame}  onSelect={setSelectedFrame} />}

            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center border border-dp-border rounded-sm overflow-hidden">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2.5 text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors" aria-label="Decrease quantity">−</button>
                <span className="px-4 py-2.5 text-[14px] font-bold text-dp-text-primary min-w-[3rem] text-center tabular-nums">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2.5 text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors" aria-label="Increase quantity">+</button>
              </div>
              <button
                onClick={() => { void handleAddToCart() }}
                disabled={adding}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-sm text-[13px] font-black uppercase tracking-widest transition-colors disabled:opacity-60 ${
                  added
                    ? "bg-dp-success text-white"
                    : "bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white"
                }`}
              >
                {adding
                  ? <><Loader2 size={16} className="animate-spin" /> Adding…</>
                  : added
                    ? <><Check size={16} /> Added to Cart</>
                    : <><ShoppingCart size={16} /> Add to Cart — {formatPrice(price * qty)}</>}
              </button>
              <button
                onClick={() => { void handleWishlist() }}
                disabled={wishWorking}
                className={`p-3 border rounded-sm transition-colors disabled:opacity-60 ${
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
                className="p-3 border border-dp-border rounded-sm text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
                aria-label={shareCopied ? "Link copied" : "Share this product"}
                title={shareCopied ? "Link copied!" : "Share"}
              >
                <Share2 size={16} />
              </button>
            </div>

            {vendorId && (
              <button
                onClick={() => {
                  if (!getAccessToken()) {
                    router.push(`/login?next=${encodeURIComponent(selfHref)}`)
                    return
                  }
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

            {product.is_limited && (
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
                    <li>Made to order — produced within 3 business days</li>
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
              <AccordionItem title="Shipping & Returns">
                Free standard shipping on orders over {formatPrice(49)}. Estimated delivery 5–8 business days.
                Not happy? Return within 100 days for a full refund — no questions asked.
              </AccordionItem>
              <AccordionItem title="Size Guide">
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  {(product.sizes ?? []).map((s) => (
                    <div key={s.id} className={`p-2 border rounded-sm ${selectedSize === s.id ? "border-dp-accent-cta bg-dp-accent-cta/10" : "border-dp-border"}`}>
                      <p className="font-bold text-dp-text-primary">{s.label.split(" ")[0]}</p>
                      <p className="text-dp-text-tertiary">{s.label.replace(/^[A-Z]+\s/, "")}</p>
                    </div>
                  ))}
                </div>
              </AccordionItem>
            </div>
          </div>
        </div>
      </div>

      {isFigure ? (
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
            className={`shrink-0 flex items-center gap-2 px-8 py-4 rounded-sm text-[13px] font-black uppercase tracking-widest transition-colors ${
              added ? "bg-dp-success text-white" : "bg-white text-dp-accent-cta hover:bg-dp-bg-elevated"
            }`}
          >
            {added
              ? <><Check size={16} /> Added!</>
              : <><ShoppingCart size={16} /> Add to Cart — {formatPrice(price * qty)}</>}
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
        <ProductContactModal product={product} vendorId={vendorId} onClose={() => setShowContact(false)} />
      )}
    </SiteShell>
  )
}
