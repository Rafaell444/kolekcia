"use client"

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react"
import { getAccessToken } from "@/lib/auth-storage"
import { authFetch } from "@/lib/api"

export type GamificationProfile = {
  xp: number
  points: number
  level: number
  streak_days: number
  recent_xp: Array<{ id: number; action: string; xp_amount: number; created_at: string }>
  earned_badges: Array<{
    id: number
    badge: { id: number; name: string; icon: string; rarity: string; description: string }
    earned_at: string
  }>
}

type GamificationContextValue = {
  profile: GamificationProfile | null
  loading: boolean
  refresh: () => Promise<void>
}

const GamificationContext = createContext<GamificationContextValue | null>(null)

const STORAGE_KEY_PREFIX = "kol_gamification_"

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

export function GamificationProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [profile, setProfile] = useState<GamificationProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const prevTokenRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const fetchProfile = useCallback(async (userId?: string) => {
    setLoading(true)
    try {
      const data = await authFetch<GamificationProfile>("/gamification/profile/")
      setProfile(data)
      // Per-user localStorage cache
      const uid = userId ?? userIdRef.current
      if (uid) {
        localStorage.setItem(getStorageKey(uid), JSON.stringify(data))
      }
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
      if (token !== prevTokenRef.current) {
        prevTokenRef.current = token
        if (token) {
          // Decode user id from JWT payload (base64)
          try {
            const payload = JSON.parse(atob(token.split(".")[1])) as { user_id?: string }
            const uid = payload.user_id
            if (uid && uid !== userIdRef.current) {
              userIdRef.current = uid
              // Try to restore cached profile for this user
              const cached = localStorage.getItem(getStorageKey(uid))
              if (cached) {
                try { setProfile(JSON.parse(cached) as GamificationProfile) } catch { /* noop */ }
              }
            }
            fetchProfile(uid)
          } catch {
            fetchProfile()
          }
        } else {
          setProfile(null)
          userIdRef.current = null
        }
      }
    }

    check()
    const interval = setInterval(check, 2000)
    return () => clearInterval(interval)
  }, [fetchProfile])

  return (
    <GamificationContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </GamificationContext.Provider>
  )
}

export function useGamification(): GamificationContextValue {
  const ctx = useContext(GamificationContext)
  if (!ctx) throw new Error("useGamification must be used within GamificationProvider")
  return ctx
}
