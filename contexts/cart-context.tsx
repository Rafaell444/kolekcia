"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { authFetch } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"

export type CartItemType = {
  id: number
  variant: {
    id: number
    size: { id: string; label: string; surcharge: string }
    finish: { id: string; label: string; surcharge: string }
    frame: { id: string; label: string; surcharge: string }
    stock: number
    price: string
  }
  quantity: number
  line_total: string
  product_title: string
  product_image: string
}

export type CartType = {
  id: number
  items: CartItemType[]
  subtotal: string
  promo_code_str: string | null
}

type CartContextValue = {
  cart: CartType | null
  itemCount: number
  loading: boolean
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  refresh: () => Promise<void>
  addItem: (variantId: number, quantity?: number) => Promise<void>
  removeItem: (itemId: number) => Promise<void>
  updateQuantity: (itemId: number, quantity: number) => Promise<void>
  applyPromo: (code: string) => Promise<void>
  removePromo: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [cart, setCart] = useState<CartType | null>(null)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setCart(null)
      return
    }
    setLoading(true)
    try {
      const data = await authFetch<CartType>("/orders/cart/")
      setCart(data)
    } catch {
      setCart(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addItem = useCallback(async (variantId: number, quantity = 1) => {
    const data = await authFetch<CartType>("/orders/cart/items/", {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity }),
    })
    setCart(data)
    setIsOpen(true)
  }, [])

  const removeItem = useCallback(async (itemId: number) => {
    const data = await authFetch<CartType>(`/orders/cart/items/${itemId}/`, { method: "DELETE" })
    setCart(data)
  }, [])

  const updateQuantity = useCallback(async (itemId: number, quantity: number) => {
    const data = await authFetch<CartType>(`/orders/cart/items/${itemId}/`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    })
    setCart(data)
  }, [])

  const applyPromo = useCallback(async (code: string) => {
    const data = await authFetch<CartType>("/orders/cart/promo/", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
    setCart(data)
  }, [])

  const removePromo = useCallback(async () => {
    const data = await authFetch<CartType>("/orders/cart/promo/", { method: "DELETE" })
    setCart(data)
  }, [])

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <CartContext.Provider value={{ cart, itemCount, loading, isOpen, openCart, closeCart, refresh, addItem, removeItem, updateQuantity, applyPromo, removePromo }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
