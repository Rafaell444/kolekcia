const ACCESS_KEY = "kol_access"
const REFRESH_KEY = "kol_refresh"
const USER_KEY = "kol_user"

export function storeTokens(access: string, refresh: string, rememberMe: boolean): void {
  const storage = rememberMe ? localStorage : sessionStorage
  storage.setItem(ACCESS_KEY, access)
  storage.setItem(REFRESH_KEY, refresh)
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
