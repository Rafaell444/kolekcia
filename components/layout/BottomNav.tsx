"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { authFetch } from "@/lib/api"

// ─── SVG Icons ───────────────────────────────────────────────

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V10.5Z"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        fill={active ? "currentColor" : "none"}
        fillOpacity="0.15"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconPanels({ active }: { active: boolean }) {
  const sw = active ? "2" : "1.5"
  const fo = active ? "0.15" : "0"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={fo} />
      <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={fo} />
      <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={fo} />
      <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={fo} />
    </svg>
  )
}

function IconFigures({ active }: { active: boolean }) {
  const sw = active ? "2" : "1.5"
  const fo = active ? "0.15" : "0"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="5.5" r="2.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={fo} />
      <path
        d="M8 11C8 9.9 8.9 9 10 9H14C15.1 9 16 9.9 16 11V15H8V11Z"
        stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={fo} strokeLinejoin="round"
      />
      <path d="M9.5 15V21" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <path d="M14.5 15V21" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  )
}

function IconCart({ active, count }: { active: boolean; count: number }) {
  const sw = active ? "2" : "1.5"
  const fo = active ? "0.15" : "0"
  return (
    <div className="relative">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 2L3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6L18 2H6Z"
          stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={fo} strokeLinejoin="round"
        />
        <path d="M3 6H21" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        <path d="M16 10C16 12.2 14.2 14 12 14C9.8 14 8 12.2 8 10" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-dp-accent-cta text-white text-[9px] font-black flex items-center justify-center leading-none pointer-events-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  )
}

function IconAuction({ active }: { active: boolean }) {
  const sw = active ? "2" : "1.5"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* Gavel strike */}
      <path d="M14 2L22 10L18 14L10 6L14 2Z" stroke="currentColor" strokeWidth={sw} fill={active ? "currentColor" : "none"} fillOpacity="0.15" strokeLinejoin="round" />
      {/* Handle */}
      <path d="M11 13L5 19C4.4 19.6 4.4 20.6 5 21.2C5.6 21.8 6.6 21.8 7.2 21.2L13 15"
        stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
      />
      {/* Base line */}
      <path d="M3 22H13" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  )
}

// ─── Nav items ───────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/",         label: "Home",    key: "home" },
  { href: "/artists",  label: "Panels",  key: "panels" },
  { href: "/custom",   label: "Figures", key: "figures" },
  { href: "/cart",     label: "Cart",    key: "cart" },
  { href: "/auctions", label: "Auction", key: "auction" },
] as const

// ─── Component ───────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname()
  const [cartCount, setCartCount] = useState(0)

  // Lightly fetch cart item count (best-effort, no crash if fails)
  useEffect(() => {
    authFetch<{ items: { quantity: number }[] }>("/orders/cart/")
      .then((data) => {
        const count = (data.items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)
        setCartCount(count)
      })
      .catch(() => {})
  }, [pathname]) // re-check when page changes

  function isActive(href: string) {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Content spacer — prevents page content being hidden under the nav bar */}
      <div className="h-[64px] lg:hidden" aria-hidden />

      {/* Fixed bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 lg:hidden"
        aria-label="Mobile navigation"
        style={{ WebkitBackfaceVisibility: "hidden" }}
      >
        <div
          className="border-t border-dp-border shadow-[0_-2px_20px_rgba(0,0,0,0.3)]"
          style={{ background: "var(--dp-bg-surface)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
        >
          <ul className="flex items-stretch h-16 max-w-lg mx-auto" role="list">
            {NAV_ITEMS.map(({ href, label, key }) => {
              const active = isActive(href)
              return (
                <li key={key} className="flex-1 relative">
                  {/* Active indicator at top */}
                  {active && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-b-full bg-dp-accent-cta"
                      aria-hidden
                    />
                  )}

                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center justify-center gap-[5px] h-full w-full select-none transition-colors duration-150 ${
                      active ? "text-dp-accent-cta" : "text-dp-text-tertiary active:text-dp-text-secondary"
                    }`}
                  >
                    {/* Icon */}
                    <span className="flex items-center justify-center">
                      {key === "home"    && <IconHome    active={active} />}
                      {key === "panels"  && <IconPanels  active={active} />}
                      {key === "figures" && <IconFigures active={active} />}
                      {key === "cart"    && <IconCart    active={active} count={cartCount} />}
                      {key === "auction" && <IconAuction active={active} />}
                    </span>

                    {/* Label */}
                    <span className={`text-[10px] leading-none tracking-wide ${active ? "font-bold" : "font-medium"}`}>
                      {label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>
    </>
  )
}
