"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import { authFetch } from "@/lib/api"
import { formatAmount } from "@/lib/product-pricing"
import type { Currency } from "@/contexts/locale-context"
import { ArrowLeft, Package } from "lucide-react"
import { useLocalePrefix } from "@/lib/use-localized-href"

type OrderItem = {
  id: number
  product_title: string
  product_image: string
  artist_name: string
  size_label: string
  finish_label: string
  frame_label: string
  price: string
  quantity: number
  line_total: string
  gift_wrap?: boolean
  gift_wrap_note?: string
  processing_option?: string
  processing_fee?: string
  processing_label?: string
  processing_days?: string
}

type StatusHistory = {
  id: number
  status: string
  note: string
  changed_at: string
}

type OrderDetail = {
  id: string
  order_number: string
  status: string
  items: OrderItem[]
  status_history: StatusHistory[]
  shipping_name: string
  shipping_line1: string
  shipping_line2: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  shipping_country: string
  shipping_email: string
  shipping_phone: string
  subtotal: string
  discount: string
  delivery_type?: string
  delivery_price?: string
  gift_wrap_total?: string
  processing_fee_total?: string
  currency: string
  total: string
  promo_code_str: string | null
  tracking_code: string
  created_at: string
}

export default function AccountOrderDetailPage(): React.ReactElement {
  const params = useParams()
  const orderId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""
  const lp = useLocalePrefix()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!orderId) {
      setError("Missing order id.")
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError("")
    authFetch<OrderDetail>(`/orders/${orderId}/`)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const apiErr = err as { status?: number; data?: { detail?: string } }
        if (apiErr?.status === 404) {
          setError("Order not found.")
        } else if (apiErr?.status === 401) {
          setError("Please sign in to view this order.")
        } else {
          setError(apiErr?.data?.detail || "Could not load this order.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [orderId])

  const money = (amount: string | number | null | undefined) =>
    formatAmount(amount, ((order?.currency || "USD") as Currency))

  return (
    <SiteShell>
      <div className="dp-container py-12 max-w-3xl">
        <Link href={`${lp}/account/orders`} className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary hover:text-dp-text-primary mb-6">
          <ArrowLeft size={14} /> Back to orders
        </Link>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-dp-bg-elevated rounded-sm" />
            <div className="h-48 bg-dp-bg-elevated rounded-sm" />
          </div>
        ) : error || !order ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <Package size={40} className="text-dp-text-tertiary" />
            <p className="text-dp-text-secondary">{error || "Order not found."}</p>
            <Link
              href={`${lp}/account/orders`}
              className="text-[12px] font-bold uppercase tracking-widest text-dp-accent-cta hover:underline"
            >
              View all orders
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl text-dp-text-primary">{order.order_number}</h1>
                <p className="text-[13px] text-dp-text-tertiary mt-1">
                  {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 border border-dp-border rounded-sm text-dp-text-primary w-fit capitalize">
                {order.status}
              </span>
            </div>

            <div className="bg-dp-bg-surface border border-dp-border rounded-sm divide-y divide-dp-border">
              {order.items.map((item) => {
                const procFee = parseFloat(item.processing_fee || "0")
                return (
                  <div key={item.id} className="p-4 flex gap-4">
                    <div className="w-16 h-20 shrink-0 rounded-sm overflow-hidden bg-dp-bg-elevated border border-dp-border">
                      {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-dp-text-primary">{item.product_title}</p>
                      <p className="text-[12px] text-dp-text-tertiary">{item.artist_name}</p>
                      <p className="text-[11px] text-dp-text-tertiary mt-1">
                        {[item.size_label, item.finish_label, item.frame_label].filter(Boolean).join(" · ")} · Qty {item.quantity}
                      </p>
                      <p className="text-[11px] text-dp-text-tertiary mt-1">
                        Variant: {money(item.price)}
                      </p>
                      {item.processing_option && (
                        <p className="text-[11px] text-dp-text-tertiary">
                          Processing: {item.processing_label || item.processing_option}
                          {item.processing_days ? ` · ${item.processing_days}` : ""}
                          {procFee > 0 ? ` (+${money(procFee)})` : " (Included)"}
                        </p>
                      )}
                      {item.gift_wrap && (
                        <p className="text-[11px] text-dp-text-tertiary">
                          Gift wrap{item.gift_wrap_note ? ` — ${item.gift_wrap_note}` : ""}
                        </p>
                      )}
                    </div>
                    <p className="text-[14px] font-bold text-dp-text-primary shrink-0">
                      {money(parseFloat(item.price) * item.quantity)}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Shipping</h2>
                <p className="text-[13px] font-semibold text-dp-text-primary">{order.shipping_name}</p>
                <p className="text-[12px] text-dp-text-secondary mt-1 leading-relaxed">
                  {order.shipping_line1}
                  {order.shipping_line2 ? <><br />{order.shipping_line2}</> : null}
                  <br />
                  {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                  <br />
                  {order.shipping_country}
                </p>
                {order.tracking_code && (
                  <p className="text-[12px] text-dp-text-primary mt-3">Tracking: <strong>{order.tracking_code}</strong></p>
                )}
              </div>
              <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Summary</h2>
                <dl className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><dt className="text-dp-text-tertiary">Products</dt><dd>{money(order.subtotal)}</dd></div>
                  {parseFloat(order.processing_fee_total || "0") > 0 && (
                    <div className="flex justify-between"><dt className="text-dp-text-tertiary">Processing</dt><dd>{money(order.processing_fee_total)}</dd></div>
                  )}
                  {parseFloat(order.gift_wrap_total || "0") > 0 && (
                    <div className="flex justify-between"><dt className="text-dp-text-tertiary">Gift wrap</dt><dd>{money(order.gift_wrap_total)}</dd></div>
                  )}
                  {parseFloat(order.delivery_price || "0") > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-dp-text-tertiary">{(order.delivery_type || "Shipping").replace(/_/g, " ")}</dt>
                      <dd>{money(order.delivery_price)}</dd>
                    </div>
                  )}
                  {parseFloat(order.discount) > 0 && (
                    <div className="flex justify-between"><dt className="text-dp-text-tertiary">Discount</dt><dd>-{money(order.discount)}</dd></div>
                  )}
                  <div className="flex justify-between font-bold text-dp-text-primary pt-2 border-t border-dp-border">
                    <dt>Total</dt><dd>{money(order.total)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {order.status_history.length > 0 && (
              <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3">Order Updates</h2>
                <ul className="space-y-2">
                  {order.status_history.map((entry) => (
                    <li key={entry.id} className="flex justify-between gap-4 text-[12px]">
                      <span className="capitalize text-dp-text-primary font-medium">{entry.status}</span>
                      <span className="text-dp-text-tertiary">{new Date(entry.changed_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
