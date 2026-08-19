"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { getAccessToken, clearTokens, storeTokens, storeUser, getStoredUser } from "@/lib/auth-storage"
import { authFetch, apiFetch, refreshAccessToken, type ApiError } from "@/lib/api"

export type AuthUser = {
  id: string
  email: string
  name: string
  role: string
  avatar: string
  is_active: boolean
  date_joined: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  loginWithGoogle: (idToken: string, rememberMe?: boolean) => Promise<{ isNewUser: boolean }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser<AuthUser>())
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setUser(null)
      return
    }
    try {
      const me = await authFetch<AuthUser>("/auth/me/")
      setUser(me)
      storeUser(me)
    } catch (error) {
      // Keep the visible session during transient network/backend outages.
      if ((error as ApiError)?.status === 401) setUser(null)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshUser().finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshUser])

  useEffect(() => {
    const handleExpired = () => {
      clearTokens()
      setUser(null)
      setLoading(false)
    }
    window.addEventListener("kol-auth-expired", handleExpired)
    return () => window.removeEventListener("kol-auth-expired", handleExpired)
  }, [])

  useEffect(() => {
    if (!user) return

    const refreshIfNeeded = () => {
      const token = getAccessToken()
      if (!token) return
      try {
        const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
        const payload = JSON.parse(atob(encoded)) as { exp?: number }
        const expiresInMs = (payload.exp ?? 0) * 1000 - Date.now()
        if (expiresInMs < 10 * 60 * 1000) void refreshAccessToken()
      } catch {
        void refreshAccessToken()
      }
    }

    refreshIfNeeded()
    const interval = window.setInterval(refreshIfNeeded, 60_000)
    const onVisible = () => { if (document.visibilityState === "visible") refreshIfNeeded() }
    window.addEventListener("focus", refreshIfNeeded)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshIfNeeded)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [user])

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    const data = await apiFetch<{ access: string; refresh: string; user: AuthUser }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    await storeTokens(data.access, data.refresh, rememberMe)
    setUser(data.user)
    storeUser(data.user)
  }, [])

  const loginWithGoogle = useCallback(async (idToken: string, rememberMe = false) => {
    const data = await apiFetch<{ access: string; refresh: string; user: AuthUser; is_new_user?: boolean }>("/auth/google/", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    })
    await storeTokens(data.access, data.refresh, rememberMe)
    setUser(data.user)
    storeUser(data.user)
    return { isNewUser: Boolean(data.is_new_user) }
  }, [])

  const logout = useCallback(async () => {
    try {
      const { getRefreshToken } = await import("@/lib/auth-storage")
      const refresh = getRefreshToken()
      if (refresh) {
        await authFetch("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh }) })
      }
    } catch {
      // ignore
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
