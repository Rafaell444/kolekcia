"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"

export type LoyaltyTierInfo = {
  key: "genin" | "chunin" | "jonin"
  label: string
  discount_percent: string
  sale_bonus_percent: string
  threshold: number
  next_key: "chunin" | "jonin" | null
  next_label: string | null
  next_threshold: number | null
  next_sale_bonus_percent: string | null
  points_to_next: number
  progress_percent: number
  point_balance: number
}

export type LoyaltyProfile = {
  spendable_points: number
  lifetime_points: number
  pending_points: number
  tier: LoyaltyTierInfo
}

type LoyaltyContextValue = {
  profile: LoyaltyProfile | null
  loading: boolean
  refresh: () => Promise<void>
}

const LoyaltyContext = createContext<LoyaltyContextValue | null>(null)
const STORAGE_KEY_PREFIX = "kol_loyalty_"

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

export function LoyaltyProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const prevTokenRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const fetchProfile = useCallback(async (userId?: string) => {
    setLoading(true)
    try {
      const data = await authFetch<LoyaltyProfile>("/gamification/profile/")
      setProfile(data)
      const uid = userId ?? userIdRef.current
      if (uid) localStorage.setItem(getStorageKey(uid), JSON.stringify(data))
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetchProfile(), [fetchProfile])

  useEffect(() => {
    const check = () => {
      const token = getAccessToken()
      if (token === prevTokenRef.current) return
      prevTokenRef.current = token
      if (!token) {
        setProfile(null)
        userIdRef.current = null
        return
      }
      try {
        const payload = JSON.parse(atob(token.split(".")[1])) as { user_id?: string }
        const uid = payload.user_id
        if (uid && uid !== userIdRef.current) {
          userIdRef.current = uid
          const cached = localStorage.getItem(getStorageKey(uid))
          if (cached) {
            try { setProfile(JSON.parse(cached) as LoyaltyProfile) } catch { /* noop */ }
          }
        }
        void fetchProfile(uid)
      } catch {
        void fetchProfile()
      }
    }

    check()
    const interval = setInterval(check, 2000)
    return () => clearInterval(interval)
  }, [fetchProfile])

  return (
    <LoyaltyContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </LoyaltyContext.Provider>
  )
}

export function useLoyalty(): LoyaltyContextValue {
  const ctx = useContext(LoyaltyContext)
  if (!ctx) throw new Error("useLoyalty must be used within LoyaltyProvider")
  return ctx
}

export const GamificationProvider = LoyaltyProvider
export const useGamification = useLoyalty
export type GamificationProfile = LoyaltyProfile
