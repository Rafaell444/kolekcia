"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import { apiFetch } from "@/lib/api"
import { useCart } from "@/contexts/cart-context"
import { useWishlist } from "@/contexts/wishlist-context"
import { getAccessToken } from "@/lib/auth-storage"
import {
  ChevronLeft, ShoppingCart, Heart, Share2, Shield, Truck,
  RotateCcw, Check, Zap, ArrowRight, Award, Package,
  Sparkles, Clock, ChevronDown, ChevronUp, Loader2,
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
              <span className="ml-1 text-dp-text-tertiary">+${opt.surcharge}</span>
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
  id: number; title: string; artist_name: string; category_slug: string; category_name: string
  base_price: string; original_price: string | null; rating: string; review_count: number
  is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean
  images: { url: string }[]; tags: string[]
  sizes: ApiVariantOption[]; finishes: ApiVariantOption[]; frames: ApiVariantOption[]
  variants: ApiVariant[]
}
type RelatedProduct = { id: number; title: string; artist_name: string; base_price: string; image_url: string }

// ── Main interactive product detail ──────────────────────
export default function ProductDetail({ product }: { product: ApiProduct }) {
  const router = useRouter()
  const { addItem } = useCart()
  const { isWishlisted, toggle: toggleWishlist } = useWishlist()
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

  const wishlisted = isWishlisted(product.id)

  useEffect(() => {
    let cancelled = false
    apiFetch<{ results: RelatedProduct[] }>(`/products/?category=${product.category_slug}&page_size=4`)
      .then((d) => { if (!cancelled) setRelated(d.results.filter((p) => p.id !== product.id).slice(0, 4)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [product.id, product.category_slug])

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
    if (!getAccessToken()) {
      router.push(`/login?next=/catalog/${product.id}`)
      return
    }

    // Find the variant that matches the current selection (use loose compare to handle string/number IDs)
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
      router.push(`/login?next=/catalog/${product.id}`)
      return
    }
    setWishWorking(true)
    try {
      await toggleWishlist(product.id)
    } finally {
      setWishWorking(false)
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
          <span>/</span>
            <Link href={`/catalog?category=${product.category_slug}`} className="hover:text-dp-text-primary transition-colors capitalize">{product.category_name}</Link>
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
              <Link href={`/catalog?q=${product.artist_name}`} className="hover:text-dp-accent-cta transition-colors">
                {product.artist_name}
              </Link>
            </p>

            <h1 className="font-display text-4xl lg:text-5xl text-dp-text-primary leading-tight">
              {product.title}
            </h1>

            <div className="flex items-baseline gap-3">
              <span className="font-display text-4xl text-dp-text-primary">${price.toFixed(2)}</span>
              {product.original_price && (
                <span className="text-lg text-dp-text-tertiary line-through">
                  ${(parseFloat(product.original_price) + surcharge(size) + surcharge(finish) + surcharge(frame)).toFixed(2)}
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
                    : <><ShoppingCart size={16} /> Add to Cart — ${(price * qty).toFixed(2)}</>}
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
              <button className="p-3 border border-dp-border rounded-sm text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors" aria-label="Share this product">
                <Share2 size={16} />
              </button>
            </div>

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
                { icon: <Truck size={16} />,     text: "Free shipping over $49" },
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
                <ul className="list-disc list-inside space-y-1">
                  <li>Printed on 0.045&quot; thick aluminium composite</li>
                  <li>UV-resistant, fade-proof inks — no frame needed</li>
                  <li>Comes with 4 magnetic mounting pins, no tools required</li>
                  <li>Scratch and moisture resistant surface</li>
                  <li>Made to order — produced within 3 business days</li>
                </ul>
              </AccordionItem>
              <AccordionItem title="Shipping & Returns">
                Free standard shipping on orders over $49. Estimated delivery 5–8 business days.
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

      {/* ── WHY METAL PRINTS ────────────────────────────────── */}
      <section className="bg-dp-text-primary text-white py-16" aria-labelledby="metal-heading">
        <div className="dp-container">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">Why Metal?</p>
              <h2 id="metal-heading" className="font-display text-4xl md:text-5xl mb-4 leading-tight">
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

      {/* ── STRONG CTA BAND ────────────────────────────────── */}
      <section className="bg-dp-accent-cta py-10" aria-label="Add to cart CTA">
        <div className="dp-container flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-3xl md:text-4xl text-white leading-tight">
              Ready to Transform Your Space?
            </h2>
            <p className="text-white/80 text-[13px] mt-1">
              Free shipping over $49 · 100-day returns · Ships in 3 days
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
              : <><ShoppingCart size={16} /> Add to Cart — ${(price * qty).toFixed(2)}</>}
          </button>
        </div>
      </section>

      {/* ── RELATED PRODUCTS ───────────────────────────────── */}
      {related.length > 0 && (
        <section className="dp-container py-16" aria-labelledby="related-heading">
          <div className="flex items-end justify-between mb-6">
            <h2 id="related-heading" className="font-display text-3xl md:text-4xl text-dp-text-primary">
              More from {product.category_name}
            </h2>
            <Link href={`/catalog?category=${product.category_slug}`} className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((p) => (
              <Link key={p.id} href={`/catalog/${p.id}`} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover">
                <div className="aspect-poster relative bg-dp-bg-elevated overflow-hidden">
                  {p.image_url && <Image src={p.image_url} alt={p.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 25vw" />}
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-dp-text-tertiary truncate">{p.artist_name}</p>
                  <p className="text-[13px] font-semibold text-dp-text-primary truncate mt-0.5">{p.title}</p>
                  <p className="text-[14px] font-bold text-dp-text-primary mt-1">${parseFloat(p.base_price).toFixed(2)}</p>
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
    </SiteShell>
  )
}
