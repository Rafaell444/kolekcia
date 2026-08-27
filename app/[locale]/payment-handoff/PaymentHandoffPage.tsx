"use client"

import { useEffect } from "react"
import { Lock } from "lucide-react"

const CHECKOUT_HANDOFF_KEY = "kolekcia_checkout_handoff"
const CHECKOUT_HANDOFF_LEFT_KEY = "kolekcia_checkout_handoff_left"
const CHECKOUT_HANDOFF_MAX_AGE_MS = 2 * 60 * 60 * 1000

export default function PaymentHandoffPage({ locale }: { locale: string }): React.ReactElement {
  useEffect(() => {
    const returnHome = () => {
      sessionStorage.removeItem(CHECKOUT_HANDOFF_LEFT_KEY)
      window.location.replace(`/${locale}`)
    }

    const handlePageShow = () => {
      if (sessionStorage.getItem(CHECKOUT_HANDOFF_LEFT_KEY)) {
        returnHome()
      }
    }

    const handlePageHide = () => {
      sessionStorage.setItem(CHECKOUT_HANDOFF_LEFT_KEY, "1")
    }

    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("pagehide", handlePageHide)

    try {
      const raw = sessionStorage.getItem(CHECKOUT_HANDOFF_KEY)
      sessionStorage.removeItem(CHECKOUT_HANDOFF_KEY)
      if (!raw) {
        returnHome()
        return () => {
          window.removeEventListener("pageshow", handlePageShow)
          window.removeEventListener("pagehide", handlePageHide)
        }
      }

      const saved = JSON.parse(raw) as { savedAt?: number; paymentUrl?: string }
      if (!saved.savedAt || Date.now() - saved.savedAt > CHECKOUT_HANDOFF_MAX_AGE_MS) {
        returnHome()
        return () => {
          window.removeEventListener("pageshow", handlePageShow)
          window.removeEventListener("pagehide", handlePageHide)
        }
      }

      const paymentUrl = new URL(saved.paymentUrl ?? "")
      const isKeepzUrl = paymentUrl.protocol === "https:" && (
        paymentUrl.hostname === "keepz.me" || paymentUrl.hostname.endsWith(".keepz.me")
      )
      if (!isKeepzUrl) {
        returnHome()
        return () => {
          window.removeEventListener("pageshow", handlePageShow)
          window.removeEventListener("pagehide", handlePageHide)
        }
      }

      window.location.replace(paymentUrl.toString())
    } catch {
      sessionStorage.removeItem(CHECKOUT_HANDOFF_KEY)
      returnHome()
    }

    return () => {
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [locale])

  return (
    <main className="relative min-h-dvh overflow-hidden bg-dp-bg-base flex items-center justify-center px-6" aria-live="polite">
      <div className="absolute inset-x-0 top-0 h-1 bg-dp-accent-cta" aria-hidden />
      <div className="w-full max-w-md border border-dp-border bg-dp-bg-surface px-8 py-10 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <p className="font-display text-3xl text-dp-text-primary">KOLEQCIA</p>
          <div className="mt-4 h-px w-12 bg-dp-accent-cta" aria-hidden />
          <div className="mt-8 w-12 h-12 border border-dp-border bg-dp-bg-elevated flex items-center justify-center">
            <Lock size={20} className="text-dp-success" aria-hidden />
          </div>
          <p className="mt-5 font-display text-2xl text-dp-text-primary">Opening secure payment</p>
          <p className="mt-1 text-[12px] text-dp-text-tertiary">Preparing your payment options...</p>
          <span className="mt-6 w-5 h-5 border-2 border-dp-border border-t-dp-accent-cta rounded-full animate-spin" aria-hidden />
        </div>
      </div>
    </main>
  )
}
