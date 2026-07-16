const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

export type AdminVendor = {
  id: number
  name: string
  slug: string
  logo_url: string
  catalog_category_slug?: string
}

export type AdminUser = {
  id: string
  email: string
  name: string
  role: string
  is_staff: boolean
  vendor: AdminVendor | null
}

// ── Token storage (separate from site tokens) ──────────────────────────────────

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("adm_access")
}

export function getAdminRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("adm_refresh")
}

export function setAdminTokens(access: string, refresh: string): void {
  localStorage.setItem("adm_access", access)
  localStorage.setItem("adm_refresh", refresh)
}

export function clearAdminTokens(): void {
  localStorage.removeItem("adm_access")
  localStorage.removeItem("adm_refresh")
  localStorage.removeItem("adm_user")
}

export function getAdminUser(): AdminUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("adm_user")
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminUser
  } catch {
    return null
  }
}

export function setAdminUser(user: AdminUser): void {
  localStorage.setItem("adm_user", JSON.stringify(user))
}

// ── Singleton refresh ──────────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null

export async function refreshAdminToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refresh = getAdminRefreshToken()
    if (!refresh) { clearAdminTokens(); return null }
    try {
      const res = await fetch(`${API_BASE}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) { clearAdminTokens(); return null }
      const data = await res.json() as { access: string; refresh?: string }
      setAdminTokens(data.access, data.refresh ?? refresh)
      return data.access
    } catch {
      clearAdminTokens()
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

// ── adminFetch — uses admin JWT, redirects to /admin/login on auth failure ──────

export async function adminFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers })

  if (res.status === 401) {
    const newToken = await refreshAdminToken()
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`
      const retry = await fetch(`${API_BASE}${url}`, { ...options, headers })
      if (!retry.ok) {
        if (retry.status === 401) {
          clearAdminTokens()
          window.location.href = "/admin/login"
          return undefined as unknown as T
        }
        const err = await retry.json().catch(() => ({}))
        throw { status: retry.status, data: err }
      }
      if (retry.status === 204) return undefined as unknown as T
      return retry.json() as Promise<T>
    }
    clearAdminTokens()
    window.location.href = "/admin/login"
    return undefined as unknown as T
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw { status: res.status, data: err }
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}
