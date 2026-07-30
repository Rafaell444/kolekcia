"use client"

import React, { useState } from "react"
import { Tag, X } from "lucide-react"
import { useCart } from "@/contexts/cart-context"

type PromoCodeBoxProps = {
  /** Compact layout for checkout sidebar */
  compact?: boolean
}

export function PromoCodeBox({ compact = false }: PromoCodeBoxProps) {
  const { cart, applyPromo, removePromo } = useCart()
  const [promoInput, setPromoInput] = useState("")
  const [promoError, setPromoError] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)

  async function handleApplyPromo(e: React.FormEvent) {
    e.preventDefault()
    if (!promoInput.trim()) return
    setPromoError("")
    setPromoLoading(true)
    try {
      await applyPromo(promoInput.trim())
      setPromoInput("")
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setPromoError(apiErr?.data?.detail ?? "Invalid promo code.")
    } finally {
      setPromoLoading(false)
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      {cart?.promo_code_str ? (
        <div className="flex items-center justify-between px-3 py-2 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm">
          <span className="text-[12px] font-bold text-dp-accent-cta flex items-center gap-1.5">
            <Tag size={12} /> {cart.promo_code_str}
            {cart.promo_percent ? (
              <span className="font-semibold opacity-80">
                (−{cart.promo_percent}%{cart.promo_products_only ? " products" : ""})
              </span>
            ) : null}
          </span>
          <button type="button" onClick={() => { void removePromo() }} aria-label="Remove promo code">
            <X size={14} className="text-dp-accent-cta" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleApplyPromo} className="flex gap-2">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            placeholder="Voucher / promo"
            className="flex-1 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover"
            aria-label="Promo code"
          />
          <button
            type="submit"
            disabled={promoLoading}
            className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] font-bold text-dp-text-secondary hover:text-dp-text-primary disabled:opacity-50 transition-colors"
          >
            Apply
          </button>
        </form>
      )}
      {promoError && <p className="text-[11px] text-dp-accent-cta">{promoError}</p>}
    </div>
  )
}
