"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { authFetch } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"

type WishlistContextValue = {
  wishlistIds: Set<number>
  toggle: (productId: number) => Promise<void>
  isWishlisted: (productId: number) => boolean
  refresh: () => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

type WishlistItem = { id: number; product: { id: number } }
type WishlistResponse = WishlistItem[] | { results: WishlistItem[] }

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set())

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setWishlistIds(new Set())
      return
    }
    try {
      const data = await authFetch<WishlistResponse>("/products/wishlist/")
      const items: WishlistItem[] = Array.isArray(data) ? data : (data.results ?? [])
      setWishlistIds(new Set(items.map((i) => i.product.id)))
    } catch {
      setWishlistIds(new Set())
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const toggle = useCallback(async (productId: number) => {
    if (!getAccessToken()) return

    const already = wishlistIds.has(productId)
    // Optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev)
      if (already) next.delete(productId)
      else next.add(productId)
      return next
    })

    try {
      if (already) {
        await authFetch(`/products/wishlist/${productId}/`, { method: "DELETE" })
      } else {
        await authFetch("/products/wishlist/", {
          method: "POST",
          body: JSON.stringify({ product_id: productId }),
        })
      }
    } catch {
      // Revert on failure
      setWishlistIds((prev) => {
        const next = new Set(prev)
        if (already) next.add(productId)
        else next.delete(productId)
        return next
      })
    }
  }, [wishlistIds])

  const isWishlisted = useCallback((productId: number) => wishlistIds.has(productId), [wishlistIds])

  return (
    <WishlistContext.Provider value={{ wishlistIds, toggle, isWishlisted, refresh }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider")
  return ctx
}
