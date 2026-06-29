"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

/**
 * Redirects unauthenticated users to /login, preserving the current path as
 * a `next` query param so they are sent back after login.
 */
export function useRequireAuth(redirectTo = "/login") {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      const currentPath = window.location.pathname + window.location.search
      const target = `${redirectTo}?next=${encodeURIComponent(currentPath)}`
      router.replace(target)
    }
  }, [user, loading, router, redirectTo])

  return { user, loading }
}
