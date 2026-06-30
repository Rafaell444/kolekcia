"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { adminFetch } from "@/lib/admin-auth"
import { ArrowLeft, Package, Truck, Clock, CheckCircle, XCircle } from "lucide-react"

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"

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
}

type StatusHistory = {
  id: number
  status: string
  note: string
  changed_by_email: string | null
  changed_at: string
}

type OrderDetail = {
  id: string
  order_number: string
  status: OrderStatus
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
  total: string
  promo_code_str: string | null
  tracking_code: string
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; Icon: React.FC<{ size?: number }> }> = {
  pending:    { label: "Pending",    Icon: Clock       },
  processing: { label: "Processing", Icon: Package     },
  shipped:    { label: "Shipped",    Icon: Truck       },
  delivered:  { label: "Delivered",  Icon: CheckCircle },
  cancelled:  { label: "Cancelled",  Icon: XCircle     },
}

export default function AdminOrderDetailPage(): React.ReactElement {
  const params = useParams()
  const orderId = params?.id as string
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    adminFetch<OrderDetail>(`/admin/orders/${orderId}/`)
      .then((data) => { if (!cancelled) setOrder(data) })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orderId])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-8 w-48 bg-dp-bg-elevated rounded-sm mb-6" />
        <div className="animate-pulse h-64 bg-dp-bg-elevated rounded-sm" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="p-8">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary hover:text-dp-text-primary mb-6">
          <ArrowLeft size={14} /> Back to orders
        </Link>
        <p className="text-dp-text-tertiary">Order not found.</p>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending

  return (
    <div className="p-8 flex flex-col gap-6 max-w-5xl">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary hover:text-dp-text-primary w-fit">
        <ArrowLeft size={14} /> Back to orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-dp-text-primary">{order.order_number}</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">
            Placed {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border border-dp-border bg-dp-bg-elevated text-[12px] font-bold uppercase tracking-widest text-dp-text-primary w-fit">
          <cfg.Icon size={14} /> {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-dp-border">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Line Items</h2>
          </div>
          <ul className="divide-y divide-dp-border">
            {order.items.map((item) => (
              <li key={item.id} className="px-4 py-4 flex gap-4">
                <div className="w-14 h-18 shrink-0 rounded-sm overflow-hidden bg-dp-bg-elevated border border-dp-border">
                  {item.product_image && (
                    <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-dp-text-primary">{item.product_title}</p>
                  <p className="text-[12px] text-dp-text-tertiary">{item.artist_name}</p>
                  <p className="text-[11px] text-dp-text-tertiary mt-1">
                    {[item.size_label, item.finish_label, item.frame_label].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] text-dp-text-secondary">×{item.quantity}</p>
                  <p className="text-[14px] font-bold text-dp-text-primary">${parseFloat(item.line_total).toFixed(2)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3">Totals</h2>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-dp-text-tertiary">Subtotal</dt><dd>${parseFloat(order.subtotal).toFixed(2)}</dd></div>
              {parseFloat(order.discount) > 0 && (
                <div className="flex justify-between"><dt className="text-dp-text-tertiary">Discount{order.promo_code_str ? ` (${order.promo_code_str})` : ""}</dt><dd>-${parseFloat(order.discount).toFixed(2)}</dd></div>
              )}
              <div className="flex justify-between font-bold text-dp-text-primary pt-2 border-t border-dp-border">
                <dt>Total</dt><dd>${parseFloat(order.total).toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3">Shipping</h2>
            <p className="text-[13px] text-dp-text-primary font-semibold">{order.shipping_name}</p>
            <p className="text-[12px] text-dp-text-secondary mt-1 leading-relaxed">
              {order.shipping_line1}
              {order.shipping_line2 ? <><br />{order.shipping_line2}</> : null}
              <br />
              {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
              <br />
              {order.shipping_country}
            </p>
            <p className="text-[12px] text-dp-text-tertiary mt-2">{order.shipping_email}</p>
            {order.shipping_phone && <p className="text-[12px] text-dp-text-tertiary">{order.shipping_phone}</p>}
            {order.tracking_code && (
              <p className="text-[12px] text-dp-text-primary mt-3">
                Tracking: <strong>{order.tracking_code}</strong>
              </p>
            )}
          </div>
        </div>
      </div>

      {order.status_history.length > 0 && (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-dp-border">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Status History</h2>
          </div>
          <ul className="divide-y divide-dp-border">
            {order.status_history.map((entry) => (
              <li key={entry.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <span className="text-[13px] font-semibold text-dp-text-primary capitalize">{entry.status}</span>
                  {entry.note && <p className="text-[12px] text-dp-text-tertiary">{entry.note}</p>}
                </div>
                <div className="text-[11px] text-dp-text-tertiary text-right">
                  {entry.changed_by_email && <span>{entry.changed_by_email} · </span>}
                  {new Date(entry.changed_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
