"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { createPortal } from "react-dom"
import {
  ShoppingCart, User, Menu, X, Zap, Loader2, MessageSquare,
  Settings, LogOut, Package, Heart, Award,
  ArrowRight, ChevronDown, Flame, Sparkles,
  Star, Brush, Sword, Globe2, Music2, Film,
  TreePine, Rocket, Layers, Palette,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useCart } from "@/contexts/cart-context"
import { useGamification } from "@/contexts/gamification-context"
import { apiFetch, parseList, type PaginatedResponse } from "@/lib/api"
import { productHref } from "@/lib/product-url"
import TrustBar from "@/components/home/TrustBar"
import LocaleSwitcher, { LocaleSwitcherInline } from "@/components/layout/LocaleSwitcher"
import { DesktopSearch, MobileHeaderSearch, MenuSearch } from "@/components/layout/ProductSearch"
import { useLocale } from "@/contexts/locale-context"

type NavCategory = { id: string; name: string; slug: string }
type NavArtist   = { id: number; name: string; handle: string; avatar_url: string }
type NavProduct  = { id: number; slug?: string; category_slug?: string; title: string; artist_name: string; base_price: string; image_url: string }

// ── Promo banner ──────────────────────────────────────────
const PROMO_MESSAGES = [
  "FREE SHIPPING on orders over $49 — use code FREESHIP",
  "LIMITED EDITIONS: New drops every Friday at noon",
  "EARN XP with every purchase — unlock exclusive badges",
]

function PromoBanner() {
  const [idx] = useState(0)
  return (
    <div className="bg-dp-accent-cta text-white text-center py-2 px-4" role="banner">
      <p className="text-[11px] font-semibold uppercase tracking-widest">
        {PROMO_MESSAGES[idx]}
      </p>
    </div>
  )
}

// ── Category icon map ─────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  anime:    <Sword    size={14} />,
  gaming:   <Layers   size={14} />,
  space:    <Rocket   size={14} />,
  nature:   <TreePine size={14} />,
  abstract: <Palette  size={14} />,
  movies:   <Film     size={14} />,
  music:    <Music2   size={14} />,
  fantasy:  <Globe2   size={14} />,
}

// ── Mega menu panels ──────────────────────────────────────
function ShopMegaMenu({ onClose }: { onClose: () => void }) {
  const { formatPrice } = useLocale()
  const [categories, setCategories] = useState<NavCategory[]>([])
  const [artists, setArtists] = useState<NavArtist[]>([])
  const [featured, setFeatured] = useState<NavProduct[]>([])

  useEffect(() => {
    let cancelled = false
    apiFetch<NavCategory[]>("/products/categories/").then((d) => { if (!cancelled) setCategories(d) }).catch(() => {})
    apiFetch<NavArtist[] | PaginatedResponse<NavArtist>>("/products/artists/?page_size=4")
      .then((d) => { if (!cancelled) setArtists(parseList(d).slice(0, 4)) })
      .catch(() => {})
    apiFetch<{ results: NavProduct[] }>("/products/?exclusive=true&page_size=2").then((d) => { if (!cancelled) setFeatured(d.results.slice(0, 2)) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="absolute top-full left-0 w-full bg-dp-bg-surface border-b border-dp-border shadow-xl z-40">
      <div className="dp-container py-8 grid grid-cols-4 gap-8">

        {/* Col 1 — Collections */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary mb-4">Collections</p>
          <ul className="flex flex-col gap-1">
            {[
              { label: "New Arrivals",     href: "/catalog?filter=new",     icon: <Sparkles size={13} /> },
              { label: "Trending Now",     href: "/catalog?sort=popular",   icon: <Flame    size={13} /> },
              { label: "Limited Editions", href: "/catalog?filter=limited", icon: <Star     size={13} /> },
              { label: "On Sale",          href: "/catalog?filter=sale",    icon: <Zap      size={13} /> },
              { label: "Exclusive Drops",  href: "/catalog?filter=exclusive",icon:<Award    size={13} /> },
              { label: "All Designs",      href: "/catalog",                icon: <Brush    size={13} /> },
            ].map(({ label, href, icon }) => (
              <li key={label}>
                <Link
                  href={href}
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-sm text-[13px] font-semibold text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors group"
                >
                  <span className="text-dp-text-tertiary group-hover:text-dp-accent-cta transition-colors">{icon}</span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 2 — Categories */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary mb-4">Categories</p>
          <ul className="grid grid-cols-2 gap-1">
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/catalog?category=${cat.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-2 px-2 py-2 rounded-sm text-[12px] font-semibold text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors group"
                >
                  <span className="text-dp-text-tertiary group-hover:text-dp-accent-cta transition-colors">
                    {CATEGORY_ICONS[cat.slug] ?? <Layers size={13} />}
                  </span>
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Top Artists */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary mb-4">Top Artists</p>
          <ul className="flex flex-col gap-3">
            {artists.map((artist) => (
              <li key={artist.id}>
                <Link
                  href={`/artists/${artist.handle}`}
                  onClick={onClose}
                  className="flex items-center gap-3 group"
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border border-dp-border shrink-0">
                    {artist.avatar_url && <Image src={artist.avatar_url} alt={artist.name} fill className="object-cover" sizes="32px" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-dp-text-primary group-hover:text-dp-accent-cta transition-colors truncate">{artist.name}</p>
                    <p className="text-[10px] text-dp-text-tertiary">@{artist.handle}</p>
                  </div>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/catalog?sort=artist" onClick={onClose} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors mt-1">
                All Artists <ArrowRight size={11} />
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 4 — Featured Picks */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary mb-4">Editor&apos;s Picks</p>
          <div className="flex flex-col gap-3">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={productHref({ id: p.id, slug: p.slug, categorySlug: p.category_slug })}
                onClick={onClose}
                className="flex items-center gap-3 group"
              >
                <div className="relative w-12 h-16 rounded-sm overflow-hidden bg-dp-bg-elevated shrink-0">
                  {p.image_url && <Image src={p.image_url} alt={p.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="48px" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-dp-text-tertiary truncate">{p.artist_name}</p>
                  <p className="text-[13px] font-bold text-dp-text-primary group-hover:text-dp-accent-cta transition-colors truncate">{p.title}</p>
                  <p className="text-[12px] font-bold text-dp-text-primary mt-0.5">{formatPrice(parseFloat(p.base_price))}</p>
                </div>
              </Link>
            ))}
            <Link
              href="/catalog?filter=exclusive"
              onClick={onClose}
              className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] font-black uppercase tracking-widest rounded-sm transition-colors"
            >
              Shop All Exclusives <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mega nav item (desktop) ───────────────────────────────
type MegaMenuKey = "shop" | null

// ── XP levels (must match account/page.tsx LEVEL_ROADMAP) ──
const LEVEL_XP: Record<number, number> = {
  1: 150, 2: 300, 3: 600, 4: 1000, 5: 1500,
  6: 2000, 7: 3000, 8: 4500, 9: 10000, 10: Infinity,
}

function XpBar() {
  const { user } = useAuth()
  const { profile } = useGamification()

  if (!user || !profile) return null

  const xp     = profile.xp ?? 0
  const level  = profile.level ?? 1
  const nextXp = LEVEL_XP[level] ?? Infinity
  const pct    = level >= 10 ? 100 : Math.min(100, Math.round((xp / nextXp) * 100))

  return (
    <Link
      href="/account?tab=badges"
      className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm hover:border-dp-border-hover transition-colors group"
      title={`Level ${level} · ${xp} XP · ${level < 10 ? `${nextXp - xp} XP to next level` : "Max level"}`}
    >
      <Zap size={12} className="text-dp-accent-cta shrink-0" />
      <span className="text-[11px] font-bold text-dp-text-secondary group-hover:text-dp-text-primary transition-colors whitespace-nowrap">
        Lv.{level}
      </span>
      <div className="w-16 h-1.5 rounded-full bg-dp-bg-base overflow-hidden">
        <div
          className="h-full rounded-full bg-dp-accent-cta transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-dp-text-tertiary tabular-nums whitespace-nowrap">
        {level < 10 ? `${xp}/${nextXp}` : "MAX"}
      </span>
    </Link>
  )
}

// ── Live search — see ProductSearch.tsx ───────────────────

function MegaNavItem({
  label,
  menuKey,
  activeMenu,
  onEnter,
  onLeave,
  href,
  isActive,
}: {
  label: string
  menuKey?: MegaMenuKey
  activeMenu: MegaMenuKey
  onEnter: (key: MegaMenuKey) => void
  onLeave: () => void
  href?: string
  isActive?: boolean
}) {
  // Plain link (no dropdown)
  if (href && !menuKey) {
    return (
      <Link
        href={href}
        onMouseEnter={() => onEnter(null)}
        className={`flex items-center gap-0.5 text-[13px] font-semibold uppercase tracking-widest transition-colors ${
          isActive ? "text-dp-text-primary" : "text-dp-text-secondary hover:text-dp-text-primary"
        }`}
      >
        {label}
      </Link>
    )
  }

  // Link that ALSO opens a mega menu on hover
  if (href && menuKey) {
    return (
      <Link
        href={href}
        onMouseEnter={() => onEnter(menuKey)}
        className={`flex items-center gap-0.5 text-[13px] font-semibold uppercase tracking-widest transition-colors ${
          isActive || activeMenu === menuKey ? "text-dp-accent-cta" : "text-dp-text-secondary hover:text-dp-text-primary"
        }`}
      >
        {label}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${activeMenu === menuKey ? "rotate-180 text-dp-accent-cta" : ""}`}
        />
      </Link>
    )
  }

  // Button-only (dropdown, no navigation)
  return (
    <button
      onMouseEnter={() => onEnter(menuKey ?? null)}
      onClick={() => onEnter(activeMenu === menuKey ? null : (menuKey ?? null))}
      className={`flex items-center gap-0.5 text-[13px] font-semibold uppercase tracking-widest transition-colors ${
        activeMenu === menuKey ? "text-dp-accent-cta" : "text-dp-text-secondary hover:text-dp-text-primary"
      }`}
      aria-expanded={activeMenu === menuKey}
      aria-haspopup="true"
    >
      {label}
      <ChevronDown
        size={13}
        className={`transition-transform duration-200 ${activeMenu === menuKey ? "rotate-180 text-dp-accent-cta" : ""}`}
      />
    </button>
  )
}

// ── Account dropdown menu ─────────────────────────────────
function AccountMenu() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleLogout() {
    setOpen(false)
    await logout()
    router.push("/login")
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User size={15} aria-hidden />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl z-50 overflow-hidden"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-dp-border">
            <p className="text-[12px] font-bold text-dp-text-primary">
              {user ? (user.name || user.email) : "My Account"}
            </p>
            <p className="text-[11px] text-dp-text-tertiary mt-0.5">
              {user ? user.email : "Sign in for exclusive perks"}
            </p>
          </div>
          {user ? (
            <>
              {[
                { href: "/account",          icon: <User    size={13} />, label: "Profile & Orders" },
                { href: "/inbox",            icon: <MessageSquare size={13} />, label: "Inbox" },
                { href: "/account/wishlist", icon: <Heart   size={13} />, label: "Wishlist" },
                { href: "/account/awards",   icon: <Award   size={13} />, label: "Awards & XP" },
                { href: "/account/orders",   icon: <Package size={13} />, label: "Order History" },
                ...(user.role === "staff" ? [{ href: "/admin", icon: <Settings size={13} />, label: "Admin Panel" }] : []),
              ].map(({ href, icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors"
                >
                  <span className="text-dp-text-tertiary">{icon}</span>
                  {label}
                </Link>
              ))}
              <div className="border-t border-dp-border">
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors"
                >
                  <LogOut size={13} className="text-dp-text-tertiary" />
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="border-t border-dp-border">
              <Link
                href="/login"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors"
              >
                <LogOut size={13} className="text-dp-text-tertiary" />
                Sign In / Register
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────
function SiteHeader({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}) {
  const { itemCount } = useCart()
  const pathname     = usePathname()
  const [activeMenu, setActiveMenu]   = useState<MegaMenuKey>(null)
  const [mobileShop, setMobileShop]   = useState(false)
  const [mounted, setMounted]         = useState(false)
  const headerRef    = useRef<HTMLElement>(null)
  const closeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setMobileOpen = useCallback(
    (open: boolean | ((prev: boolean) => boolean)) => {
      onMobileOpenChange(typeof open === "function" ? open(mobileOpen) : open)
    },
    [mobileOpen, onMobileOpenChange]
  )

  const handleEnter = useCallback((key: MegaMenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setActiveMenu(key)
  }, [])

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setActiveMenu(null), 120)
  }, [])

  // Close mega menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Close mega menu on route change
  useEffect(() => { setActiveMenu(null); onMobileOpenChange(false) }, [pathname, onMobileOpenChange])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [mobileOpen])

  useEffect(() => { setMounted(true) }, [])

  const closeMobileMenu = useCallback(() => onMobileOpenChange(false), [onMobileOpenChange])

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 bg-dp-bg-surface border-b border-dp-border ${mobileOpen ? "max-lg:hidden" : ""}`}
      onMouseLeave={handleLeave}
    >
      <div className="dp-container flex items-center justify-between gap-4 py-3">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Kolekcia home">
          <span className="flex items-center justify-center w-7 h-7 rounded-sm border border-dp-border-hover bg-dp-bg-elevated" aria-hidden>
            <span className="block w-3.5 h-3.5 rounded-sm border-2" style={{ borderColor: "var(--dp-accent-cta)" }} />
          </span>
          <span className="font-display text-xl text-dp-text-primary tracking-wider hidden sm:block">KOLEKCIA</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
          <MegaNavItem label="Shop" menuKey="shop" href="/catalog" activeMenu={activeMenu} onEnter={handleEnter} onLeave={handleLeave} isActive={pathname.startsWith("/catalog")} />
          <MegaNavItem label="Artists"  menuKey={null} activeMenu={activeMenu} onEnter={handleEnter} onLeave={handleLeave} href="/artists"  isActive={pathname.startsWith("/artists")} />
          <MegaNavItem label="Auctions" menuKey={null} activeMenu={activeMenu} onEnter={handleEnter} onLeave={handleLeave} href="/auctions" isActive={pathname.startsWith("/auctions")} />
          <MegaNavItem label="Blog" menuKey={null} activeMenu={activeMenu} onEnter={handleEnter} onLeave={handleLeave} href="/blog" isActive={pathname.startsWith("/blog")} />
          <MegaNavItem label="Custom"   menuKey={null} activeMenu={activeMenu} onEnter={handleEnter} onLeave={handleLeave} href="/custom"   isActive={pathname.startsWith("/custom")} />
          <MegaNavItem label="About"      menuKey={null} activeMenu={activeMenu} onEnter={handleEnter} onLeave={handleLeave} href="/about"    isActive={pathname.startsWith("/about")} />
          <MegaNavItem label="Contact Us" menuKey={null} activeMenu={activeMenu} onEnter={handleEnter} onLeave={handleLeave} href="/contact"  isActive={pathname.startsWith("/contact")} />
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <XpBar />
          <MobileHeaderSearch hidden={mobileOpen} />
          <DesktopSearch />
          <Link
            href="/cart"
            className="relative flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
            aria-label={`Shopping cart, ${itemCount} items`}
          >
            <ShoppingCart size={15} aria-hidden />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-dp-accent-cta text-white text-[9px] font-bold flex items-center justify-center" aria-hidden>
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Link>
          <AccountMenu />
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-secondary hover:text-dp-text-primary transition-colors"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>

      {/* Desktop Mega Menu panels */}
      <div onMouseEnter={() => handleEnter(activeMenu)} onMouseLeave={handleLeave}>
        {activeMenu === "shop" && <ShopMegaMenu onClose={() => setActiveMenu(null)} />}
      </div>

      {/* Mobile nav — full-screen overlay (covers promo + header), bottom tab bar stays visible */}
      {mounted && mobileOpen && createPortal(
        <nav
          id="mobile-nav"
          className="lg:hidden fixed inset-x-0 top-0 bottom-16 z-[100] flex flex-col bg-dp-bg-surface"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-dp-border shrink-0">
            <Link href="/" onClick={closeMobileMenu} className="font-display text-lg text-dp-text-primary tracking-wider">
              KOLEKCIA
            </Link>
            <button
              type="button"
              onClick={closeMobileMenu}
              className="flex items-center justify-center w-9 h-9 rounded-sm border border-dp-border text-dp-text-secondary hover:text-dp-text-primary transition-colors"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="dp-container py-4 flex flex-col gap-1">
              <button
                onClick={() => setMobileShop((o) => !o)}
                className="flex items-center justify-between py-2.5 text-[14px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors"
              >
                Shop <ChevronDown size={14} className={`transition-transform ${mobileShop ? "rotate-180" : ""}`} />
              </button>
              {mobileShop && (
                <div className="pl-3 pb-2 flex flex-col gap-1 border-l-2 border-dp-accent-cta/30 ml-2">
                  {[
                    { label: "All Designs",      href: "/catalog" },
                    { label: "Wallpanels",       href: "/catalog?category=wallpanels" },
                    { label: "Figures",          href: "/catalog?category=figures" },
                    { label: "New Arrivals",      href: "/catalog?filter=new" },
                    { label: "Trending",          href: "/catalog?sort=popular" },
                    { label: "Limited Editions",  href: "/catalog?filter=limited" },
                    { label: "On Sale",           href: "/catalog?filter=sale" },
                  ].map(({ label, href }) => (
                    <Link key={label} href={href} onClick={closeMobileMenu} className="py-1.5 text-[13px] text-dp-text-secondary hover:text-dp-text-primary transition-colors">{label}</Link>
                  ))}
                </div>
              )}

              <Link href="/artists"  onClick={closeMobileMenu} className="flex py-2.5 text-[14px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors">Artists</Link>
              <Link href="/auctions" onClick={closeMobileMenu} className="flex py-2.5 text-[14px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors">Auctions</Link>
              <Link href="/blog" onClick={closeMobileMenu} className="flex py-2.5 text-[14px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors">Blog</Link>
              <Link href="/custom"   onClick={closeMobileMenu} className="flex py-2.5 text-[14px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors">Custom</Link>
              <Link href="/about"    onClick={closeMobileMenu} className="flex py-2.5 text-[14px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors">About Us</Link>
              <Link href="/contact"  onClick={closeMobileMenu} className="flex py-2.5 text-[14px] font-semibold text-dp-text-secondary hover:text-dp-text-primary transition-colors">Contact Us</Link>

              <div className="pt-3 border-t border-dp-border mt-2">
                <LocaleSwitcherInline />
              </div>

              <MenuSearch onClose={closeMobileMenu} />
            </div>
          </div>
        </nav>,
        document.body
      )}
    </header>
  )
}

// ── Footer ────────────────────────────────────────────────
function SiteFooter() {
  return (
    <footer className="bg-dp-bg-surface border-t border-dp-border mt-auto" role="contentinfo">
      <div className="dp-container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-sm border border-dp-border-hover bg-dp-bg-elevated" aria-hidden>
                <span className="block w-3 h-3 rounded-sm border-2" style={{ borderColor: "var(--dp-accent-cta)" }} />
              </span>
              <span className="font-display text-lg text-dp-text-primary tracking-wider">KOLEKCIA</span>
            </div>
            <p className="text-[12px] text-dp-text-tertiary leading-relaxed max-w-xs">
              The world&apos;s finest metal poster marketplace. Artist-made originals, licensed collections, and custom prints.
            </p>
            <div className="flex items-center gap-1.5 mt-3">
              <Zap size={10} className="text-dp-accent-cta" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-cta">Tool-free magnetic mounting</span>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-3">Shop</h3>
            <ul className="flex flex-col gap-2">
              {[
                { label: "All Products", href: "/catalog" },
                { label: "Wallpanels",   href: "/catalog?category=wallpanels" },
                { label: "Figures",      href: "/catalog?category=figures" },
                { label: "Custom",       href: "/custom" },
                { label: "Auction",      href: "/auctions" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-dp-text-secondary hover:text-dp-text-primary transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-3">Company</h3>
            <ul className="flex flex-col gap-2">
              {[
                { label: "About Us",    href: "/about" },
                { label: "Contact Us",  href: "/contact" },
                { label: "Artists",     href: "/artists" },
                { label: "Blog",        href: "/blog" },
                { label: "My Orders",   href: "/account/orders" },
                { label: "Sign In",     href: "/login" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-dp-text-secondary hover:text-dp-text-primary transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-3">Support</h3>
            <ul className="flex flex-col gap-2">
              {[
                { label: "Help Center",   href: "/contact#faq" },
                { label: "Shipping",      href: "/shipping" },
                { label: "Returns",       href: "/returns" },
                { label: "Contact Us",    href: "/contact" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-dp-text-secondary hover:text-dp-text-primary transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-dp-border">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] text-dp-text-tertiary">
              &copy; {new Date().getFullYear()} Kolekcia. All rights reserved.
            </p>
            <p className="text-[11px] text-dp-text-tertiary">
              Developed by{" "}
              <a href="https://mozaikko.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-dp-text-secondary hover:text-dp-accent-cta transition-colors">
                MOZAIKKO
              </a>
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Cookies", href: "/cookies" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="text-[11px] text-dp-text-tertiary hover:text-dp-text-secondary transition-colors">{label}</Link>
            ))}
            <LocaleSwitcher placement="top" />
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── SiteShell ─────────────────────────────────────────────
import BottomNav from "@/components/layout/BottomNav"
import FastCart from "@/components/cart/FastCart"

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const hideTrustBar =
    pathname.startsWith("/account") ||
    /^\/auctions\/[^/]+/.test(pathname)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!mobileOpen && <PromoBanner />}
      <SiteHeader mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <main className="flex-1">{children}</main>
      {!hideTrustBar && <TrustBar />}
      <SiteFooter />
      <Suspense fallback={<div className="h-[64px] lg:hidden" aria-hidden />}>
        <BottomNav />
      </Suspense>
      <FastCart />
    </div>
  )
}
