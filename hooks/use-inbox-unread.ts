"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getAccessToken } from "@/lib/auth-storage"
import { authFetch, refreshAccessToken } from "@/lib/api"
import { adminFetch, getAdminToken, refreshAdminToken } from "@/lib/admin-auth"
import { useNotificationSocket, type NotifWsEvent } from "@/hooks/use-messaging-ws"

const POLL_INTERVAL = 30_000

type FetchFn = <T>(url: string) => Promise<T>

function useInboxUnread(
  getToken: () => string | null,
  refreshToken: () => Promise<string | null>,
  fetchFn: FetchFn,
) {
  const [count, setCount] = useState(0)
  const mountedRef = useRef(true)

  const fetchCount = useCallback(async () => {
    if (!getToken() || document.hidden) return
    try {
      const data = await fetchFn<{ unread_count: number }>("/messaging/unread-count/")
      if (mountedRef.current && typeof data.unread_count === "number") {
        setCount(data.unread_count)
      }
    } catch { /* ignore */ }
  }, [getToken, fetchFn])

  useEffect(() => {
    mountedRef.current = true
    void fetchCount()
    const timer = setInterval(() => { void fetchCount() }, POLL_INTERVAL)
    function onVisibilityChange() {
      if (!document.hidden) void fetchCount()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      mountedRef.current = false
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [fetchCount])

  useEffect(() => {
    function onRead() { void fetchCount() }
    window.addEventListener("inbox-read", onRead)
    return () => window.removeEventListener("inbox-read", onRead)
  }, [fetchCount])

  const handleWs = useCallback(
    (event: NotifWsEvent) => {
      if (typeof event.unread_count === "number") {
        setCount(event.unread_count)
      }
    },
    [],
  )

  useNotificationSocket(getToken, refreshToken, handleWs)

  return count
}

export function useInboxUnreadCount() {
  return useInboxUnread(getAccessToken, refreshAccessToken, authFetch)
}

export function useAdminInboxUnreadCount() {
  return useInboxUnread(getAdminToken, refreshAdminToken, adminFetch)
}
