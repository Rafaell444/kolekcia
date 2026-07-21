"use client"

import { useEffect, useRef, useCallback, useState } from "react"

type WsMessage = Record<string, unknown>
type TokenRefresher = () => Promise<string | null>

// Disable WebSocket entirely if env var is set (for hosts like PythonAnywhere that don't support WS)
const WS_DISABLED = process.env.NEXT_PUBLIC_DISABLE_WEBSOCKET === "true"

// Max reconnection attempts before giving up (avoids spamming logs on unsupported hosts)
const MAX_RECONNECT_ATTEMPTS = 3

function wsBase(): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  const url = new URL(api)
  const proto = url.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${url.host}`
}

/** Prefer Sec-WebSocket-Protocol over ?token= so JWTs stay out of URLs/logs. */
function openAuthedWebSocket(path: string, token: string): WebSocket {
  const url = `${wsBase()}/${path}`
  try {
    return new WebSocket(url, ["access_token", token])
  } catch {
    // Some environments reject custom subprotocols; fall back to query string.
    return new WebSocket(`${url}?token=${encodeURIComponent(token)}`)
  }
}

function useStableWs(
  path: string | null,
  getToken: () => string | null,
  refreshToken: TokenRefresher | null,
  onMessage: (data: WsMessage) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  const hasTriedRefresh = useRef(false)
  const failureCount = useRef(0)
  const gaveUp = useRef(false)
  onMessageRef.current = onMessage

  const connect = useCallback(async () => {
    // Skip if WebSocket is disabled or we've given up
    if (WS_DISABLED || gaveUp.current) return
    
    const token = getToken()
    if (!path || !token) return

    const ws = openAuthedWebSocket(path, token)
    wsRef.current = ws

    let wasAccepted = false

    ws.onopen = () => {
      hasTriedRefresh.current = false
      failureCount.current = 0 // Reset on successful connection
    }

    ws.onmessage = (e) => {
      wasAccepted = true
      failureCount.current = 0 // Reset on successful message
      try {
        const data = JSON.parse(e.data) as WsMessage
        onMessageRef.current(data)
      } catch { /* ignore non-JSON */ }
    }

    ws.onclose = async () => {
      wsRef.current = null
      
      // If closed immediately without receiving any message (auth rejected), try refresh
      if (!wasAccepted && !hasTriedRefresh.current && refreshToken) {
        hasTriedRefresh.current = true
        const newToken = await refreshToken()
        if (newToken) {
          // Retry immediately with refreshed token
          reconnectTimer.current = setTimeout(() => void connect(), 100)
          return
        }
      }
      
      // Track failures and give up after max attempts
      failureCount.current++
      if (failureCount.current >= MAX_RECONNECT_ATTEMPTS) {
        gaveUp.current = true
        console.info("[WS] WebSocket unavailable, falling back to HTTP polling")
        return
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      const delay = Math.min(1000 * Math.pow(2, failureCount.current - 1), 10000)
      reconnectTimer.current = setTimeout(() => void connect(), delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [path, getToken, refreshToken])

  useEffect(() => {
    if (WS_DISABLED) return
    void connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return wsRef
}

// ── Chat socket (per conversation) ───────────────────────────────────────────

export type ChatWsEvent =
  | { type: "new_message"; conversation_id: number; message: Record<string, unknown> }
  | { type: "read_update"; conversation_id: number; reader_user_id: string }

export function useChatSocket(
  convId: string | number | null,
  getToken: () => string | null,
  refreshToken: TokenRefresher | null,
  onEvent: (event: ChatWsEvent) => void,
) {
  const path = convId ? `ws/messaging/chat/${convId}/` : null
  useStableWs(path, getToken, refreshToken, onEvent as (data: WsMessage) => void)
}

// ── Notification socket (per user, persistent) ──────────────────────────────

export type NotifWsEvent =
  | { type: "unread_count"; unread_count: number }

export function useNotificationSocket(
  getToken: () => string | null,
  refreshToken: TokenRefresher | null,
  onEvent?: (event: NotifWsEvent) => void,
) {
  const [unreadCount, setUnreadCount] = useState(0)

  const handler = useCallback(
    (data: WsMessage) => {
      if (data.type === "unread_count" && typeof data.unread_count === "number") {
        setUnreadCount(data.unread_count)
      }
      if (onEvent) onEvent(data as NotifWsEvent)
    },
    [onEvent],
  )

  const hasToken = getToken() !== null
  const path = hasToken ? "ws/messaging/notifications/" : null
  useStableWs(path, getToken, refreshToken, handler)

  return unreadCount
}
