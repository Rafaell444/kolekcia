const ACCESS_KEY = "kol_access"
const REFRESH_KEY = "kol_refresh"
const USER_KEY = "kol_user"

/** Persist refresh token in an httpOnly cookie (XSS-resistant). */
async function persistRefreshCookie(refresh: string, rememberMe: boolean): Promise<void> {
  try {
    await fetch("/api/auth/set-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh, rememberMe }),
      credentials: "include",
    })
  } catch {
    // Cookie route unavailable (e.g. SSR) — access still works from memory storage.
  }
}

async function clearRefreshCookie(): Promise<void> {
  try {
    await fetch("/api/auth/clear-token", {
      method: "POST",
      credentials: "include",
    })
  } catch {
    // ignore
  }
}

/**
 * Access token stays in session/local storage (short-lived, used as Bearer).
 * Refresh token is stored primarily in an httpOnly cookie; a storage copy is
 * kept as a same-origin fallback if the cookie route is unavailable.
 */
export function storeTokens(access: string, refresh: string, rememberMe: boolean): void {
  if (typeof window === "undefined") return
  if (rememberMe) {
    sessionStorage.removeItem(ACCESS_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(USER_KEY)
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  } else {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.setItem(ACCESS_KEY, access)
    sessionStorage.setItem(REFRESH_KEY, refresh)
  }
  void persistRefreshCookie(refresh, rememberMe)
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(ACCESS_KEY) ?? localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(REFRESH_KEY) ?? localStorage.getItem(REFRESH_KEY)
}

export function clearTokens(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  void clearRefreshCookie()
}

export function storeUser(user: object): void {
  if (typeof window === "undefined") return
  const storage = localStorage.getItem(ACCESS_KEY) ? localStorage : sessionStorage
  storage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser<T>(): T | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
