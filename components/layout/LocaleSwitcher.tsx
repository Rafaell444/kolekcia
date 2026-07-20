"use client"

import React, { useState, useRef, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, Check } from "lucide-react"
import { useLocale, LANGUAGES, type Language } from "@/contexts/locale-context"
import FlagIcon from "@/components/ui/FlagIcon"
import { stripLocalePrefix } from "@/lib/i18n"

// ─── Compact header button ────────────────────────────────────────────────────

export default function LocaleSwitcher({ placement = "bottom" }: { placement?: "bottom" | "top" }) {
  const { currentLang, currentCur, setLanguage } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  function switchLang(code: Language) {
    setLanguage(code)
    setOpen(false)
    const stripped = stripLocalePrefix(pathname)
    router.push(`/${code}${stripped}`)
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1.5 h-8 px-2.5 rounded-sm border text-[12px] font-semibold transition-colors ${
          open
            ? "border-dp-accent-cta text-dp-text-primary bg-dp-bg-elevated"
            : "border-dp-border text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover bg-transparent"
        }`}
      >
        <FlagIcon code={currentLang.code} size={18} />
        <span className="uppercase tracking-widest">{currentLang.code}</span>
        <span className="text-dp-border-hover">·</span>
        <FlagIcon code={currentCur.code} size={18} />
        <span className="uppercase tracking-widest">{currentCur.code}</span>
        <ChevronDown
          size={11}
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel — language only */}
      {open && (
        <div
          className={`absolute right-0 w-56 bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl z-[200] overflow-hidden ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
          role="dialog"
          aria-label="Language selector"
        >
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Language</p>
          </div>

          <ul className="py-1">
            {LANGUAGES.map((lang) => {
              const active = lang.code === currentLang.code
              return (
                <li key={lang.code}>
                  <button
                    onClick={() => switchLang(lang.code as Language)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active
                        ? "bg-dp-accent-cta/8 text-dp-text-primary"
                        : "hover:bg-dp-bg-elevated text-dp-text-secondary"
                    }`}
                  >
                    <FlagIcon code={lang.code} size={22} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight">{lang.nativeLabel}</p>
                      <p className="text-[11px] text-dp-text-tertiary">{lang.label}</p>
                    </div>
                    {active && <Check size={14} className="text-dp-accent-cta shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Currency read-only info */}
          <div className="border-t border-dp-border px-4 py-2.5 bg-dp-bg-elevated flex items-center gap-2">
            <FlagIcon code={currentCur.code} size={16} />
            <p className="text-[11px] text-dp-text-tertiary leading-relaxed">
              <span className="font-semibold text-dp-text-secondary">{currentCur.symbol} {currentCur.code}</span>
              {" "}— set automatically by your region.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inline (expanded) version for mobile nav ────────────────────────────────

export function LocaleSwitcherInline() {
  const { currentLang, currentCur, setLanguage } = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  function switchLang(code: Language) {
    setLanguage(code)
    const stripped = stripLocalePrefix(pathname)
    router.push(`/${code}${stripped}`)
  }

  return (
    <div className="flex flex-col gap-4 py-3">
      {/* Language */}
      <div>
        <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-2 px-1">Language</p>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((lang) => {
            const active = lang.code === currentLang.code
            return (
              <button
                key={lang.code}
                onClick={() => switchLang(lang.code as Language)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-[12px] font-semibold transition-colors ${
                  active
                    ? "border-dp-accent-cta bg-dp-accent-cta/10 text-dp-accent-cta"
                    : "border-dp-border text-dp-text-secondary hover:border-dp-border-hover hover:text-dp-text-primary"
                }`}
              >
                <FlagIcon code={lang.code} size={16} />
                <span className="uppercase tracking-widest">{lang.code}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Currency — read-only, auto-detected */}
      <div>
        <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest mb-2 px-1">Currency</p>
        <div className="flex items-center gap-2 px-1">
          <FlagIcon code={currentCur.code} size={18} />
          <span className="text-[13px] font-semibold text-dp-text-primary">
            {currentCur.symbol} {currentCur.code}
          </span>
          <span className="text-[11px] text-dp-text-tertiary">— set by your region</span>
        </div>
      </div>
    </div>
  )
}
