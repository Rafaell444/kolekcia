"use client"

import { getAccessToken } from "@/lib/auth-storage"
import { getAdminToken } from "@/lib/admin-auth"
import { useNotificationSocket } from "@/hooks/use-messaging-ws"

export function useInboxUnreadCount() {
  const token = typeof window !== "undefined" ? getAccessToken() : null
  return useNotificationSocket(token)
}

export function useAdminInboxUnreadCount() {
  const token = typeof window !== "undefined" ? getAdminToken() : null
  return useNotificationSocket(token)
}
