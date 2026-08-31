"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/api"

export type PaymentStatus = {
  order_id: string
  order_number: string
  status: string
  payment_status: string
  is_paid: boolean
  is_failed: boolean
  is_final: boolean
}

type Options = {
  /** Skip polling entirely (e.g. the user did not arrive from the gateway). */
  enabled?: boolean
  /** Stop polling after this long and tell the user we'll email them. */
  timeoutMs?: number
}

const FIRST_DELAY_MS = 1500
const MAX_DELAY_MS = 8000
const DEFAULT_TIMEOUT_MS = 90_000

/**
 * Observe the server's view of a payment after returning from the gateway.
 *
 * The client never confirms a payment. Keepz notifies the backend, the backend
 * verifies it server-to-server, and this hook only reports whatever the backend
 * has already decided. If the webhook is slow, the reconciliation job settles
 * the order within a few minutes and the confirmation email still goes out —
 * which is why timing out here is not an error state.
 */
export function usePaymentStatus(orderId: string, { enabled = true, timeoutMs = DEFAULT_TIMEOUT_MS }: Options = {}) {
  const [status, setStatus] = useState<PaymentStatus | null>(null)
  const [isPolling, setIsPolling] = useState(enabled && Boolean(orderId))
  const [timedOut, setTimedOut] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    if (!enabled || !orderId) {
      setIsPolling(false)
      return
    }

    let cancelled = false
    const startedAt = Date.now()
    let delay = FIRST_DELAY_MS

    const poll = async () => {
      if (cancelled) return
      try {
        const next = await authFetch<PaymentStatus>(`/orders/${orderId}/status/`)
        if (cancelled) return
        setStatus(next)
        if (next.is_final) {
          setIsPolling(false)
          return
        }
      } catch {
        // Transient failures are expected right after the redirect; keep trying.
      }
      if (cancelled) return
      if (Date.now() - startedAt >= timeoutMs) {
        setTimedOut(true)
        setIsPolling(false)
        return
      }
      delay = Math.min(delay * 1.5, MAX_DELAY_MS)
      timer.current = setTimeout(poll, delay)
    }

    setIsPolling(true)
    timer.current = setTimeout(poll, FIRST_DELAY_MS)

    return () => {
      cancelled = true
      stop()
    }
  }, [orderId, enabled, timeoutMs, stop])

  return { status, isPolling, timedOut }
}
