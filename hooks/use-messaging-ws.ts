"use client"

import { useEffect, useRef, useCallback, useState } from "react"

type WsMessage = Record<string, unknown>

function wsBase(): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  const url = new URL(api)
  const proto = url.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${url.host}`
}

function useStableWs(
  path: string | null,
  token: string | null,
  onMessage: (data: WsMessage) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (!path || !token) return
    const url = `${wsBase()}/${path}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WsMessage
        onMessageRef.current(data)
      } catch { /* ignore non-JSON */ }
    }

    ws.onclose = () => {
      wsRef.current = null
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [path, token])

  useEffect(() => {
    connect()
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
  | { type: "read_update"; conversation_id: number; reader_user_id: number }

export function useChatSocket(
  convId: string | number | null,
  token: string | null,
  onEvent: (event: ChatWsEvent) => void,
) {
  const path = convId ? `ws/messaging/chat/${convId}/` : null
  useStableWs(path, token, onEvent as (data: WsMessage) => void)
}

// ── Notification socket (per user, persistent) ──────────────────────────────

export type NotifWsEvent =
  | { type: "unread_count"; unread_count: number }

export function useNotificationSocket(
  token: string | null,
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

  const path = token ? "ws/messaging/notifications/" : null
  useStableWs(path, token, handler)

  return unreadCount
}
