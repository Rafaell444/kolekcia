"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Package, ShoppingCart, Users, Paintbrush,
  Gavel, MessageSquare, Tag, Settings, ChevronRight, BarChart2,
  Image as ImageIcon, Star, Bell, LogOut, Trophy, Shield, Store,
} from "lucide-react"
import { ThemeSwitcher } from "@/components/ThemeSwitcher"
import { getAdminUser, clearAdminTokens, type AdminUser } from "@/lib/admin-auth"

// ── Nav definitions ────────────────────────────────────────────────────────────

const SUPERADMIN_NAV = [
  {
    section: "Overview",
    links: [
      { href: "/admin",           label: "Dashboard",     Icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics",     Icon: BarChart2 },
    ],
  },
  {
    section: "Commerce",
    links: [
      { href: "/admin/products",      label: "Products",       Icon: ImageIcon },
      { href: "/admin/orders",        label: "Orders",         Icon: ShoppingCart },
      { href: "/admin/custom-orders", label: "Custom Orders",  Icon: Package },
      { href: "/admin/coupons",       label: "Coupons",        Icon: Tag },
    ],
  },
  {
    section: "Community",
    links: [
      { href: "/admin/users",     label: "Users",         Icon: Users },
      { href: "/admin/artists",   label: "Artists",       Icon: Paintbrush },
      { href: "/admin/reviews",   label: "Reviews",       Icon: Star },
    ],
  },
  {
    section: "Platform",
    links: [
      { href: "/admin/auctions",     label: "Auctions",      Icon: Gavel },
      { href: "/admin/gamification", label: "Gamification",  Icon: Trophy },
      { href: "/admin/inbox",        label: "Inbox",         Icon: MessageSquare },
    ],
  },
  {
    section: "Content",
    links: [
      { href: "/admin/hero",       label: "Hero Slides",   Icon: ImageIcon },
      { href: "/admin/blog",       label: "Blog",          Icon: MessageSquare },
      { href: "/admin/categories", label: "Categories",    Icon: Package },
      { href: "/admin/banners",    label: "Promo Banners", Icon: Bell },
    ],
  },
  {
    section: "Vendors",
    links: [
      { href: "/admin/vendors",   label: "Vendors",        Icon: Store },
      { href: "/admin/roles",     label: "Roles",          Icon: Shield },
      { href: "/admin/settings",  label: "Settings",       Icon: Settings },
    ],
  },
]

const VENDOR_NAV = [
  {
    section: "My Store",
    links: [
      { href: "/admin",                  label: "Dashboard",      Icon: LayoutDashboard },
      { href: "/admin/products",         label: "My Products",    Icon: ImageIcon },
      { href: "/admin/orders",           label: "Orders",         Icon: ShoppingCart },
      { href: "/admin/custom-orders",    label: "Custom Orders",  Icon: Package },
      { href: "/admin/users",            label: "Customers",      Icon: Users },
      { href: "/admin/analytics",        label: "Analytics",      Icon: BarChart2 },
      { href: "/admin/inbox",            label: "Inbox",          Icon: MessageSquare },
    ],
  },
  {
    section: "Account",
    links: [
      { href: "/admin/settings",         label: "Settings",       Icon: Settings },
    ],
  },
]

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [ready, setReady] = useState(false)

  const isLoginPage = pathname === "/admin/login"

  useEffect(() => {
    if (isLoginPage) {
      setReady(true)
      return
    }
    const user = getAdminUser()
    const token = typeof window !== "undefined" ? localStorage.getItem("adm_access") : null
    if (!user || !token) {
      router.replace("/admin/login")
      return
    }
    setAdminUser(user)
    setReady(true)
  }, [isLoginPage, router])

  if (!ready) {
    return <div className="min-h-screen bg-dp-bg-base" />
  }

  if (isLoginPage) return <>{children}</>
  if (!adminUser) return null

  const isVendor = !adminUser.is_staff && !!adminUser.vendor
  const navSections = isVendor ? VENDOR_NAV : SUPERADMIN_NAV
  const displayName = adminUser.vendor?.name ?? adminUser.name ?? "Admin"
  const displayEmail = adminUser.email

  function handleLogout() {
    clearAdminTokens()
    router.push("/admin/login")
  }

  return (
    <div className="min-h-screen bg-dp-bg-base flex">
      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 bg-dp-bg-surface border-r border-dp-border flex flex-col sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-dp-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-sm border border-dp-border-hover bg-dp-bg-elevated flex items-center justify-center" aria-hidden>
              <div className="w-3.5 h-3.5 rounded-sm border-2" style={{ borderColor: "var(--dp-accent-cta)" }} />
            </div>
            <span className="font-display text-lg text-dp-text-primary tracking-wider">KOLEKCIA</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {isVendor ? (
              <>
                <Store size={10} className="text-dp-accent-cta" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-cta">Vendor Panel</span>
              </>
            ) : (
              <>
                <Shield size={10} className="text-dp-accent-cta" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-accent-cta">Superadmin</span>
              </>
            )}
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 py-3 overflow-y-auto" aria-label="Admin navigation">
          {navSections.map((section) => (
            <div key={section.section} className="mb-1">
              <p className="px-5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-dp-text-tertiary">
                {section.section}
              </p>
              {section.links.map(({ href, label, Icon }) => {
                const active = pathname === href || (href !== "/admin" && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center justify-between px-5 py-2.5 text-[13px] font-medium transition-colors group ${
                      active
                        ? "bg-dp-bg-elevated text-dp-text-primary border-r-2 border-dp-accent-cta"
                        : "text-dp-text-secondary hover:bg-dp-bg-elevated hover:text-dp-text-primary"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={15} className={active ? "text-dp-accent-cta" : "text-dp-text-tertiary group-hover:text-dp-text-secondary"} aria-hidden />
                      {label}
                    </span>
                    {active && <ChevronRight size={12} className="text-dp-text-tertiary" aria-hidden />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-5 py-4 border-t border-dp-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-dp-accent-cta flex items-center justify-center text-white text-[12px] font-bold shrink-0 uppercase">
            {displayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-dp-text-primary truncate">{displayName}</p>
            <p className="text-[10px] text-dp-text-tertiary truncate">{displayEmail}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeSwitcher />
            <button
              onClick={handleLogout}
              className="text-dp-text-tertiary hover:text-dp-accent-cta transition-colors"
              aria-label="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
