"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n"

/**
 * Redirects unauthenticated users to /{locale}/login, preserving the current path as
 * a `next` query param so they are sent back after login.
 */
export function useRequireAuth(redirectTo?: string) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const raw = (params?.locale as string) ?? DEFAULT_LOCALE
  const locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE
  const loginPath = redirectTo ?? `/${locale}/login`

  useEffect(() => {
    if (!loading && !user) {
      const currentPath = window.location.pathname + window.location.search
      const target = `${loginPath}?next=${encodeURIComponent(currentPath)}`
      router.replace(target)
    }
  }, [user, loading, router, loginPath])

  return { user, loading }
}
