"use client"

import React, { useState } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, ArrowRight, Trash2, Tag, X } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { useAuth } from "@/contexts/auth-context"
import { useRequireAuth } from "@/hooks/useRequireAuth"

export default function CartPage(): React.ReactElement {
  useRequireAuth()
  const { user } = useAuth()
  const { cart, loading, removeItem, updateQuantity, applyPromo, removePromo } = useCart()
  const [promoInput, setPromoInput] = useState("")
  const [promoError, setPromoError] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)

  const subtotal = cart ? parseFloat(cart.subtotal) : 0
  const shipping = subtotal >= 49 ? 0 : 7.99
  const total = subtotal + shipping

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

  if (!user) {
    return (
      <SiteShell>
        <div className="dp-container py-24 flex flex-col items-center gap-4 text-center">
          <ShoppingCart size={40} className="text-dp-text-tertiary" />
          <p className="text-[15px] text-dp-text-secondary">Sign in to view your cart.</p>
          <Link href="/login" className="px-6 py-3 bg-dp-accent-cta text-white text-[12px] font-black uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors">
            Sign In
          </Link>
        </div>
      </SiteShell>
    )
  }

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <h1 className="font-display text-4xl text-dp-text-primary mb-8">Your Cart</h1>
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-dp-bg-elevated rounded-sm" />)}
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <ShoppingCart size={40} className="text-dp-text-tertiary" />
            <p className="text-[15px] text-dp-text-secondary">Your cart is empty.</p>
            <Link href="/catalog" className="px-6 py-3 bg-dp-accent-cta text-white text-[12px] font-black uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors">
              Browse Shop
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 bg-dp-bg-surface border border-dp-border rounded-sm">
                  <div className="relative w-20 h-28 rounded-sm overflow-hidden shrink-0">
                    <Image src={item.product_image || "/placeholder.svg"} alt={item.product_title} fill className="object-cover" sizes="80px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-dp-text-primary">{item.product_title}</p>
                    <p className="text-[12px] text-dp-text-secondary mt-1">
                      {item.variant.size.label} · {item.variant.finish.label} · {item.variant.frame.label}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-dp-border rounded-sm overflow-hidden text-[13px]">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2.5 py-1.5 hover:bg-dp-bg-elevated transition-colors"
                          aria-label="Decrease quantity"
                        >−</button>
                        <span className="px-3">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2.5 py-1.5 hover:bg-dp-bg-elevated transition-colors"
                          aria-label="Increase quantity"
                        >+</button>
                      </div>
                      <span className="text-[15px] font-bold text-dp-text-primary">${parseFloat(item.line_total).toFixed(2)}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="ml-auto text-dp-text-tertiary hover:text-dp-accent-cta transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6 h-fit flex flex-col gap-4">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Order Summary</h2>

              {/* Promo code */}
              {cart.promo_code_str ? (
                <div className="flex items-center justify-between px-3 py-2 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm">
                  <span className="text-[12px] font-bold text-dp-accent-cta flex items-center gap-1.5">
                    <Tag size={12} /> {cart.promo_code_str}
                  </span>
                  <button onClick={removePromo} aria-label="Remove promo code">
                    <X size={14} className="text-dp-accent-cta" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Promo code"
                    className="flex-1 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover"
                    aria-label="Promo code"
                  />
                  <button
                    type="submit"
                    disabled={promoLoading}
                    className="px-4 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] font-bold text-dp-text-secondary hover:text-dp-text-primary disabled:opacity-50 transition-colors"
                  >
                    Apply
                  </button>
                </form>
              )}
              {promoError && <p className="text-[11px] text-dp-accent-cta">{promoError}</p>}

              <div className="flex justify-between text-[13px] text-dp-text-secondary">
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-dp-text-secondary">
                <span>Shipping</span><span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="border-t border-dp-border pt-4 flex justify-between font-bold text-[16px] text-dp-text-primary">
                <span>Total</span><span>${total.toFixed(2)}</span>
              </div>
              <Link
                href="/checkout"
                className="flex items-center justify-center gap-2 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
              >
                Checkout <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  )
}
