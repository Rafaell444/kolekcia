"use client"

import React from "react"
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"
import type { PaymentStatus } from "@/lib/use-payment-status"

type Props = {
  status: PaymentStatus | null
  isPolling: boolean
  timedOut: boolean
}

/**
 * Post-redirect banner for the order page.
 *
 * Purely a reflection of server state — nothing here can mark an order paid.
 */
export default function PaymentVerifying({ status, isPolling, timedOut }: Props): React.ReactElement | null {
  if (status?.is_paid) {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
        <div>
          <p className="text-[13px] font-semibold text-dp-text-primary">Payment confirmed</p>
          <p className="text-[12px] text-dp-text-secondary">
            Thank you — we&apos;ve emailed your receipt and started preparing your order.
          </p>
        </div>
      </div>
    )
  }

  if (status?.is_failed) {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3">
        <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
        <div>
          <p className="text-[13px] font-semibold text-dp-text-primary">Payment not completed</p>
          <p className="text-[12px] text-dp-text-secondary">
            No money was taken and the reserved items have been released. You can place the order again.
          </p>
        </div>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <Clock size={18} className="mt-0.5 shrink-0 text-amber-500" />
        <div>
          <p className="text-[13px] font-semibold text-dp-text-primary">Still confirming your payment</p>
          <p className="text-[12px] text-dp-text-secondary">
            This is taking longer than usual. Your order is safe — we&apos;ll email you as soon as the bank
            confirms it. No need to pay again.
          </p>
        </div>
      </div>
    )
  }

  if (isPolling) {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-dp-border bg-dp-bg-elevated px-4 py-3">
        <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-dp-accent-cta" />
        <div>
          <p className="text-[13px] font-semibold text-dp-text-primary">Verifying payment…</p>
          <p className="text-[12px] text-dp-text-secondary">
            We&apos;re confirming this with your bank. Please don&apos;t close this page or pay again.
          </p>
        </div>
      </div>
    )
  }

  return null
}
