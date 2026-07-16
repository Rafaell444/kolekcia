import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from "./auth-storage"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

// Singleton refresh promise — prevents concurrent refresh races
let refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refresh = getRefreshToken()
    if (!refresh) {
      clearTokens()
      return null
    }

    try {
      const res = await fetch(`${API_BASE}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      })

      if (!res.ok) {
        clearTokens()
        return null
      }

      const data = await res.json() as { access: string; refresh?: string }
      storeTokens(data.access, data.refresh ?? refresh, !!localStorage.getItem("kol_access"))
      return data.access
    } catch {
      clearTokens()
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export type ApiError = {
  status: number
  data: Record<string, unknown>
}

export type PaginatedResponse<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** DRF may return a bare array or a paginated envelope. */
export function parseList<T>(data: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : (data.results ?? [])
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  authenticated = false,
  retries = 0,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  }

  if (authenticated) {
    const token = getAccessToken()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers })

  if (res.status === 401 && authenticated) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`
      const retry = await fetch(`${API_BASE}${url}`, { ...options, headers })
      if (!retry.ok) {
        const errData = await retry.json().catch(() => ({}))
        const err: ApiError = { status: retry.status, data: errData as Record<string, unknown> }
        throw err
      }
      return retry.json() as Promise<T>
    }
    // Refresh failed — clear and throw
    clearTokens()
    const err: ApiError = { status: 401, data: { detail: "Session expired. Please log in again." } }
    throw err
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    const err: ApiError = { status: res.status, data: errData as Record<string, unknown> }
    throw err
  }

  if (res.status === 204) return undefined as unknown as T

  return res.json() as Promise<T>
}

/** Public (no auth) fetch — with optional 3x retry */
export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  maxRetries = 0,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await request<T>(url, options, false)
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }
  throw lastError
}

/** Authenticated fetch */
export async function authFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  return request<T>(url, options, true)
}

/** Convenience wrappers */
export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "POST", body: JSON.stringify(body) }),
}

export const auth = {
  get: <T>(url: string) => authFetch<T>(url),
  post: <T>(url: string, body: unknown) =>
    authFetch<T>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    authFetch<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(url: string) => authFetch<T>(url, { method: "DELETE" }),
}

/** Extract a user-facing message from an authFetch/apiFetch error. */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err || typeof err !== "object") return fallback
  const data = (err as ApiError).data
  if (!data) return fallback
  if (typeof data.detail === "string") return data.detail
  if (Array.isArray(data.detail)) return data.detail.map(String).join(" ")
  for (const value of Object.values(data)) {
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return String(value[0])
  }
  return fallback
}
