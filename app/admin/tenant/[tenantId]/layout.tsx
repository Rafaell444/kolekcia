"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useParams } from "next/navigation"
import {
  LayoutDashboard, ShoppingCart, Package, CreditCard,
  ChevronRight, LogOut, ArrowLeft, Settings,
} from "lucide-react"
import { ThemeSwitcher } from "@/components/ThemeSwitcher"
import { ThemeProvider } from "@/components/ThemeProvider"

export default function TenantAdminLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname()
  const params = useParams<{ tenantId: string }>()
  const tenantId = params.tenantId ?? ""

  const base = `/admin/tenant/${tenantId}`
  const initials = tenantId.slice(0, 2).toUpperCase()

  const NAV = [
    { href: base,               label: "Dashboard", Icon: LayoutDashboard, exact: true },
    { href: `${base}/orders`,   label: "Orders",    Icon: ShoppingCart },
    { href: `${base}/products`, label: "Products",  Icon: Package },
    { href: `${base}/payments`, label: "Payments",  Icon: CreditCard },
    { href: `${base}/settings`, label: "Settings",  Icon: Settings },
  ]

  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dp-bg-base">
        <div className="text-center">
          <p className="font-display text-3xl text-dp-text-primary mb-2">Tenant not found</p>
          <Link href="/admin" className="text-[13px] text-dp-accent-cta hover:underline">Back to portal selector</Link>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-dp-bg-base flex">
      <aside className="w-60 shrink-0 bg-dp-bg-surface border-r border-dp-border flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="px-5 py-5 border-b border-dp-border">
          <Link href="/" className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-sm text-white text-[11px] font-black bg-dp-accent-cta">
              {initials}
            </span>
            <span className="font-display text-base text-dp-text-primary tracking-wider leading-tight capitalize">{tenantId}</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-dp-accent-cta/10 text-dp-accent-cta">
            Vendor
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto" aria-label="Vendor admin navigation">
          <p className="px-5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-dp-text-tertiary">Vendor Portal</p>
          {NAV.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href + "/") || pathname === href
            return (
              <Link key={href} href={href}
                className={`flex items-center justify-between px-5 py-2.5 text-[13px] font-medium transition-colors group ${active ? "bg-dp-bg-elevated text-dp-text-primary border-r-2 border-dp-accent-cta" : "text-dp-text-secondary hover:bg-dp-bg-elevated hover:text-dp-text-primary"}`}>
                <span className="flex items-center gap-2.5">
                  <Icon size={15} className={active ? "text-dp-accent-cta" : ""} aria-hidden />
                  {label}
                </span>
                {active && <ChevronRight size={12} className="text-dp-text-tertiary" aria-hidden />}
              </Link>
            )
          })}
          <div className="mt-4 px-5 pt-4 border-t border-dp-border">
            <Link href="/admin" className="flex items-center gap-2 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
              <ArrowLeft size={12} aria-hidden /> Back to Portal Selector
            </Link>
          </div>
        </nav>

        <div className="px-5 py-4 border-t border-dp-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 bg-dp-accent-cta">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-dp-text-primary truncate capitalize">{tenantId}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeSwitcher />
            <button className="text-dp-text-tertiary hover:text-dp-accent-cta transition-colors" aria-label="Log out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
    </ThemeProvider>
  )
}
