"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Lock, Package } from "lucide-react"
import SiteShell from "@/components/layout/SiteShell"
import { useLoyalty } from "@/contexts/gamification-context"
import { authFetch, getApiErrorMessage } from "@/lib/api"

type ShippingPaymentSession = {
  token: string
  status: "pending" | "paid" | "cancelled" | "expired"
  item_name: string
  item_image_url: string
  point_cost: number
  shipping_name: string
  shipping_line1: string
  shipping_line2: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  shipping_country: string
  shipping_email: string
  shipping_phone: string
  shipping_type: string
  shipping_label: string
  shipping_price: string
  shipping_currency: string
  expires_at: string
}

export default function PointsShippingPaymentPage(): React.ReactElement {
  const params = useSearchParams()
  const pathname = usePathname()
  const locale = pathname.split("/").filter(Boolean)[0] || "en"
  const token = params.get("session") || ""
  const { refresh } = useLoyalty()
  const [session, setSession] = useState<ShippingPaymentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("Missing shipping payment session.")
      setLoading(false)
      return
    }
    authFetch<ShippingPaymentSession>(`/gamification/market/shipping-payment/${token}/`)
      .then(setSession)
      .catch((err) => setError(getApiErrorMessage(err, "Could not load shipping payment session.")))
      .finally(() => setLoading(false))
  }, [token])

  async function completePayment() {
    if (!token) return
    setPaying(true)
    setError("")
    try {
      await authFetch(`/gamification/market/shipping-payment/${token}/complete/`, { method: "POST" })
      await refresh()
      setDone(true)
      setSession((prev) => prev ? { ...prev, status: "paid" } : prev)
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not complete shipping payment."))
    } finally {
      setPaying(false)
    }
  }

  const amount = session ? `${session.shipping_price} ${session.shipping_currency}` : ""

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <Link href={`/${locale}/account/awards`} className="mb-6 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-dp-text-tertiary hover:text-dp-text-primary">
          <ArrowLeft size={14} /> Back to points market
        </Link>

        <div className="mx-auto max-w-2xl rounded-sm border border-dp-border bg-dp-bg-surface p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-gold">Points reward shipping</p>
          <h1 className="mt-2 font-display text-4xl text-dp-text-primary">Complete Shipping Payment</h1>
          <p className="mt-2 text-[13px] text-dp-text-secondary">
            Points and reward stock are not changed until this shipping payment is completed.
          </p>

          {loading && <div className="mt-6 h-40 animate-pulse rounded-sm bg-dp-bg-elevated" />}
          {error && <div className="mt-6 rounded-sm border border-dp-accent-cta/30 bg-dp-accent-cta/10 px-4 py-3 text-[13px] text-dp-accent-cta">{error}</div>}

          {session && (
            <div className="mt-6 space-y-5">
              <div className="flex gap-4 rounded-sm border border-dp-border bg-dp-bg-elevated p-4">
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-sm border border-dp-border bg-dp-bg-surface">
                  <Image src={session.item_image_url || "/placeholder.svg"} alt={session.item_name} fill className="object-contain p-1" sizes="80px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl text-dp-text-primary">{session.item_name}</p>
                  <p className="mt-1 text-[12px] text-dp-text-tertiary">{session.point_cost.toLocaleString()} points will be spent after payment.</p>
                  <div className="mt-3 flex items-center justify-between rounded-sm bg-dp-bg-surface px-3 py-2 text-[13px]">
                    <span className="text-dp-text-secondary">{session.shipping_label}</span>
                    <strong className="text-dp-text-primary">{amount}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-sm border border-dp-border p-4">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-dp-text-tertiary">
                  <Package size={13} /> Delivery address
                </p>
                <p className="text-[13px] font-semibold text-dp-text-primary">{session.shipping_name}</p>
                <p className="text-[12px] text-dp-text-secondary">
                  {session.shipping_line1}{session.shipping_line2 ? `, ${session.shipping_line2}` : ""}, {session.shipping_city}, {session.shipping_state}, {session.shipping_zip}, {session.shipping_country}
                </p>
                <p className="mt-1 text-[11px] text-dp-text-tertiary">{session.shipping_email}{session.shipping_phone ? ` · ${session.shipping_phone}` : ""}</p>
              </div>

              {done || session.status === "paid" ? (
                <div className="rounded-sm border border-dp-success/30 bg-dp-success/10 px-4 py-3 text-[13px] text-dp-success">
                  <CheckCircle2 size={16} className="mr-2 inline" /> Shipping payment completed. Your reward redemption was created for admin fulfillment.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void completePayment()}
                  disabled={paying || session.status !== "pending"}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-dp-accent-cta px-4 py-3.5 text-[12px] font-black uppercase tracking-widest text-white disabled:opacity-60"
                >
                  {paying ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Lock size={14} />}
                  Pay Shipping {amount}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  )
}
