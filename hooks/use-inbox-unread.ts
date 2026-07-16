"use client"

import { getAccessToken } from "@/lib/auth-storage"
import { refreshAccessToken } from "@/lib/api"
import { getAdminToken, refreshAdminToken } from "@/lib/admin-auth"
import { useNotificationSocket } from "@/hooks/use-messaging-ws"

export function useInboxUnreadCount() {
  return useNotificationSocket(getAccessToken, refreshAccessToken)
}

export function useAdminInboxUnreadCount() {
  return useNotificationSocket(getAdminToken, refreshAdminToken)
}
