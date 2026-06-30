"use client"

import { useEffect, useRef } from "react"
import { authFetch } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"
import { useAuth } from "@/contexts/auth-context"

const REF_STORAGE_KEY = "pending_referral_code"

export default function ReferralTracker(): null {
  const { user } = useAuth()
  const claimingRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const ref = (params.get("ref") || "").trim().toUpperCase()
    if (ref) {
      localStorage.setItem(REF_STORAGE_KEY, ref)
    }
  }, [])

  useEffect(() => {
    if (!user || !getAccessToken() || claimingRef.current || typeof window === "undefined") return
    const code = localStorage.getItem(REF_STORAGE_KEY)
    if (!code) return
    claimingRef.current = true
    authFetch("/referrals/claim/", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
      .then(() => {
        localStorage.removeItem(REF_STORAGE_KEY)
      })
      .catch(() => {})
      .finally(() => {
        claimingRef.current = false
      })
  }, [user])

  return null
}
