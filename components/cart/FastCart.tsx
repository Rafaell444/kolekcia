"use client"

import React, { useEffect, useRef } from "react"
import Link from "next/link"
import { X, ShoppingCart, Minus, Plus, Trash2, ArrowRight, Package } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useLocalePrefix } from "@/lib/use-localized-href"
import { useTranslations } from "@/hooks/use-translations"
import { CartItemExtras } from "@/components/cart/CartItemExtras"

export default function FastCart() {
  const { cart, isOpen, closeCart, removeItem, updateQuantity, loading } = useCart()
  const { formatPrice } = useLocale()
  const lp = useLocalePrefix()
  const { t } = useTranslations()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart()
    }
    if (isOpen) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen, closeCart])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  const items = cart?.items ?? []
  const subtotal = parseFloat(cart?.subtotal ?? "0")

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={closeCart}
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("cart.title")}
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[400px] bg-dp-bg-surface border-l border-dp-border shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={18} className="text-dp-accent-cta" />
            <h2 className="font-display text-2xl text-dp-text-primary leading-none">{t("cart.title")}</h2>
            {items.length > 0 && (
              <span className="px-2 py-0.5 bg-dp-accent-cta text-white text-[11px] font-bold rounded-full">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
            aria-label={t("cart.closeCart")}
          >
            <X size={15} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && items.length === 0 ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-16 h-20 bg-dp-bg-elevated rounded-sm shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-dp-bg-elevated rounded-sm w-3/4" />
                    <div className="h-3 bg-dp-bg-elevated rounded-sm w-1/2" />
                    <div className="h-3 bg-dp-bg-elevated rounded-sm w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-dp-text-tertiary py-16">
              <Package size={48} className="opacity-20" />
              <p className="text-[14px] font-semibold text-dp-text-secondary">{t("cart.empty")}</p>
              <p className="text-[12px] text-center leading-relaxed">
                {t("cart.emptyHint")}
              </p>
              <Link
                href={`${lp}/catalog`}
                onClick={closeCart}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-wider rounded-sm transition-colors"
              >
                {t("common.shopNow")} <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 group">
                  {/* Image */}
                  <div className="w-16 h-20 shrink-0 rounded-sm overflow-hidden bg-dp-bg-elevated border border-dp-border">
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={16} className="text-dp-text-tertiary" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold text-dp-text-primary leading-tight truncate">
                      {item.product_title}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {/* New size_variant label */}
                      {item.size_label && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-tertiary">
                          {item.size_label}
                        </span>
                      )}
                      {!item.size_label && item.variant?.size?.label && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-tertiary">
                          {item.variant.size.label}
                        </span>
                      )}
                      {item.variant?.finish?.label && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-tertiary">
                          {item.variant.finish.label}
                        </span>
                      )}
                      {item.variant?.frame?.label && item.variant.frame.label !== "No Frame" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-tertiary">
                          {item.variant.frame.label}
                        </span>
                      )}
                    </div>

                    <CartItemExtras item={item} formatPrice={formatPrice} compact />

                    <div className="flex items-center justify-between mt-auto">
                      {/* Qty controls */}
                      <div className="flex items-center border border-dp-border rounded-sm overflow-hidden">
                        <button
                          onClick={() => {
                            if (item.quantity <= 1) {
                              void removeItem(item.id)
                            } else {
                              void updateQuantity(item.id, item.quantity - 1)
                            }
                          }}
                          className="w-7 h-7 flex items-center justify-center text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors text-[14px]"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-7 h-7 flex items-center justify-center text-[12px] font-bold text-dp-text-primary tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus size={10} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-dp-text-primary">
                          {formatPrice(parseFloat(item.line_total))}
                        </p>
                        <button
                          onClick={() => void removeItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 text-dp-text-tertiary hover:text-red-400 transition-all"
                          aria-label="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="shrink-0 px-5 py-4 border-t border-dp-border bg-dp-bg-surface space-y-3">
            {/* Promo code strip */}
            {cart?.promo_code_str && (
              <div className="flex items-center justify-between py-2 px-3 bg-dp-success/10 border border-dp-success/30 rounded-sm">
                <p className="text-[12px] text-dp-success font-semibold">
                  Promo: {cart.promo_code_str}
                </p>
              </div>
            )}

            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-dp-text-secondary">
                {t("cart.subtotal")} ({items.reduce((s, i) => s + i.quantity, 0)} {t("cart.items")})
              </p>
              <p className="text-[18px] font-black text-dp-text-primary font-display">
                {formatPrice(subtotal)}
              </p>
            </div>
            <p className="text-[11px] text-dp-text-tertiary -mt-1">
              {t("cart.shippingNote")}
            </p>

            {/* CTAs */}
            <Link
              href={`${lp}/checkout`}
              onClick={closeCart}
              className="flex items-center justify-center gap-2 w-full py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors"
            >
              {t("cart.checkout")} — {formatPrice(subtotal)} <ArrowRight size={15} />
            </Link>
            <Link
              href={`${lp}/cart`}
              onClick={closeCart}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-transparent border border-dp-border hover:border-dp-border-hover text-dp-text-secondary hover:text-dp-text-primary text-[12px] font-semibold uppercase tracking-wider rounded-sm transition-colors"
            >
              {t("cart.viewFullCart")}
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
