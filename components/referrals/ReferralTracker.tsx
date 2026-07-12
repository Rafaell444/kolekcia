"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { getAccessToken } from "@/lib/auth-storage"
import { useAuth } from "@/contexts/auth-context"
import { captureReferralFromUrl, claimPendingReferral, getPendingReferralCode } from "@/lib/referral"

export default function ReferralTracker(): null {
  const { user } = useAuth()
  const claimingRef = useRef(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    captureReferralFromUrl(searchParams.toString() ? `?${searchParams.toString()}` : undefined)
  }, [pathname, searchParams])

  useEffect(() => {
    if (!user || !getAccessToken() || claimingRef.current) return
    if (!getPendingReferralCode()) return
    claimingRef.current = true
    claimPendingReferral().finally(() => {
      claimingRef.current = false
    })
  }, [user])

  return null
}
