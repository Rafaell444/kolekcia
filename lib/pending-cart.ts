const PENDING_CART_KEY = "kolekcia_pending_cart"

export type PendingCartIntent = {
  variantId?: number
  sizeVariantId?: number
  quantity: number
  returnTo: string
}

export function savePendingCartIntent(intent: PendingCartIntent): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PENDING_CART_KEY, JSON.stringify(intent))
}

export function getPendingCartIntent(): PendingCartIntent | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(PENDING_CART_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingCartIntent
  } catch {
    return null
  }
}

export function clearPendingCartIntent(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PENDING_CART_KEY)
}
