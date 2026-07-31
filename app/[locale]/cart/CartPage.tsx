"use client"

import React from "react"
import SiteShell from "@/components/layout/SiteShell"
import LocalizedLink from "@/components/seo/LocalizedLink"
import Image from "next/image"
import { ShoppingCart, ArrowRight, Trash2 } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { useAuth } from "@/contexts/auth-context"
import { useRequireAuth } from "@/hooks/useRequireAuth"
import { useLocale } from "@/contexts/locale-context"
import { CartItemExtras } from "@/components/cart/CartItemExtras"
import { PromoCodeBox } from "@/components/cart/PromoCodeBox"

export default function CartPage(): React.ReactElement {
  useRequireAuth()
  const { user } = useAuth()
  const { cart, loading, removeItem, updateQuantity } = useCart()
  const { formatPrice } = useLocale()

  const items = cart?.items ?? []
  const giftWrapTotal = items.reduce(
    (sum, item) => sum + (item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0),
    0,
  )
  const processingTotal = items.reduce(
    (sum, item) => sum + (item.processing_option ? parseFloat(item.processing_fee || "0") : 0),
    0,
  )
  const productsTotal = items.reduce((sum, item) => {
    const unit = parseFloat(item.unit_price || "0")
    if (unit > 0) return sum + unit * item.quantity
    const line = parseFloat(item.line_total || "0")
    const wrap = item.gift_wrap ? parseFloat(item.gift_wrap_price || "0") : 0
    const proc = item.processing_option ? parseFloat(item.processing_fee || "0") : 0
    return sum + Math.max(0, line - wrap - proc)
  }, 0)
  const discount = parseFloat(cart?.discount || "0")
  const subtotal = productsTotal + giftWrapTotal + processingTotal
  const total = Math.max(0, subtotal - discount)

  if (!user) {
    return (
      <SiteShell>
        <div className="dp-container py-24 flex flex-col items-center gap-4 text-center">
          <ShoppingCart size={40} className="text-dp-text-tertiary" />
          <p className="text-[15px] text-dp-text-secondary">Sign in to view your cart.</p>
          <LocalizedLink href="/login" className="px-6 py-3 bg-dp-accent-cta text-white text-[12px] font-black uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors">
            Sign In
          </LocalizedLink>
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
            <LocalizedLink href="/catalog" className="px-6 py-3 bg-dp-accent-cta text-white text-[12px] font-black uppercase tracking-widest rounded-sm hover:bg-dp-accent-cta-hover transition-colors">
              Browse Shop
            </LocalizedLink>
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
                      {item.size_label
                        ? item.size_label
                        : `${item.variant?.size?.label ?? ""} · ${item.variant?.finish?.label ?? ""} · ${item.variant?.frame?.label ?? ""}`}
                    </p>
                    <CartItemExtras item={item} formatPrice={formatPrice} />
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-dp-border rounded-sm overflow-hidden text-[13px]">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2.5 py-1.5 hover:bg-dp-bg-elevated transition-colors"
                          aria-label="Decrease quantity"
                        >−</button>
                        <span className="px-3">{item.quantity}</span>
                        <button
                          onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.size_variant?.stock != null
                            ? item.quantity >= item.size_variant.stock
                            : item.variant?.stock != null && item.quantity >= item.variant.stock}
                          className="px-2.5 py-1.5 hover:bg-dp-bg-elevated transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                          aria-label="Increase quantity"
                        >+</button>
                      </div>
                      <span className="text-[15px] font-bold text-dp-text-primary">{formatPrice(parseFloat(item.line_total))}</span>
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
              <PromoCodeBox />

              <div className="flex justify-between text-[13px] text-dp-text-secondary">
                <span>Products</span><span>{formatPrice(productsTotal)}</span>
              </div>
              {processingTotal > 0 && (
                <div className="flex justify-between text-[13px] text-dp-text-secondary">
                  <span>Processing</span><span>{formatPrice(processingTotal)}</span>
                </div>
              )}
              {giftWrapTotal > 0 && (
                <div className="flex justify-between text-[13px] text-dp-text-secondary">
                  <span>Gift wrap</span><span>{formatPrice(giftWrapTotal)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-[13px] text-dp-success">
                  <span>
                    Discount{cart?.promo_code_str ? ` (${cart.promo_code_str})` : ""}
                    {cart?.promo_products_only ? " · products" : ""}
                  </span>
                  <span>−{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] text-dp-text-secondary">
                <span>Shipping</span><span className="text-dp-text-tertiary">At checkout</span>
              </div>
              <div className="border-t border-dp-border pt-4 flex justify-between font-bold text-[16px] text-dp-text-primary">
                <span>Total</span><span>{formatPrice(total)}</span>
              </div>
              <LocalizedLink
                href="/checkout"
                className="flex items-center justify-center gap-2 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
              >
                Checkout <ArrowRight size={14} />
              </LocalizedLink>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  )
}
