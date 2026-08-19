"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { MessageSquare, Send, Loader2, Flag } from "lucide-react"
import { apiFetch, authFetch, getApiErrorMessage, refreshAccessToken } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"

type ChatMessage = {
  id: number
  user_name: string
  text: string
  created_at: string
  is_deleted?: boolean
}

type AuctionLiveChatProps = {
  auctionId: number
  isLive: boolean
}

function wsBaseUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  const origin = api.replace(/\/api\/?$/, "")
  return origin.replace(/^http/, "ws")
}

export default function AuctionLiveChat({ auctionId, isLive }: AuctionLiveChatProps): React.ReactElement | null {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [reported, setReported] = useState<Set<number>>(new Set())
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const prevMsgCount = useRef(0)

  const scrollToBottom = useCallback(() => {
    const el = chatContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (!isLive) return
    let cancelled = false
    apiFetch<ChatMessage[]>(`/auctions/${auctionId}/chat/`)
      .then((list) => { if (!cancelled) setMessages(list) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [auctionId, isLive])

  useEffect(() => {
    const count = messages.length
    if (count > prevMsgCount.current) {
      requestAnimationFrame(scrollToBottom)
    }
    prevMsgCount.current = count
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!isLive) return
    const url = `${wsBaseUrl()}/ws/auctions/${auctionId}/`
    let stopped = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    async function connect(refresh = false) {
      const token = refresh ? await refreshAccessToken() : getAccessToken()
      if (!token || stopped) return
      let ws: WebSocket
      try {
        ws = new WebSocket(url, ["access_token", token])
      } catch {
        ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`)
      }
      wsRef.current = ws
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as ChatMessage & { type?: string; detail?: string }
          if (payload.type === "chat_error") {
            setError(payload.detail ?? "Message rejected.")
            return
          }
          setMessages((prev) => {
            const existing = prev.findIndex((message) => message.id === payload.id)
            if (existing < 0) return [...prev, payload]
            return prev.map((message, index) => index === existing ? payload : message)
          })
        } catch { /* ignore malformed frames */ }
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        if (!stopped) reconnectTimer = setTimeout(() => void connect(true), 1000)
      }
    }
    void connect()

    return () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [auctionId, isLive])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return

    if (!getAccessToken()) {
      setError("Log in to chat.")
      return
    }

    setSending(true)
    setError("")
    try {
      const msg = await authFetch<ChatMessage>(`/auctions/${auctionId}/chat/`, {
        method: "POST",
        body: JSON.stringify({ text: trimmed }),
      })
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      setText("")
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send message."))
    } finally {
      setSending(false)
    }
  }

  async function reportMessage(message: ChatMessage) {
    const reason = window.prompt("Why are you reporting this message?")
    if (!reason?.trim()) return
    try {
      await authFetch("/messaging/reports/", {
        method: "POST",
        body: JSON.stringify({ target_type: "auction", target_id: message.id, reason: reason.trim() }),
      })
      setReported((current) => new Set(current).add(message.id))
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not report message."))
    }
  }

  if (!isLive) return null

  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden flex flex-col h-[360px]">
      <div className="px-4 py-3 border-b border-dp-border flex items-center gap-2">
        <MessageSquare size={14} className="text-dp-accent-cta" />
        <h3 className="font-display text-lg text-dp-text-primary">Live Chat</h3>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-dp-accent-cta">
          <span className="w-1.5 h-1.5 rounded-full bg-dp-accent-cta animate-pulse" />
          Live
        </span>
      </div>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-dp-text-tertiary" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[12px] text-dp-text-tertiary py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-[12px] group flex items-start gap-1">
              <div className="flex-1">
              <span className="font-semibold text-dp-text-primary">{m.user_name}</span>
              <span className="text-dp-text-tertiary mx-1.5">·</span>
              <span className={m.is_deleted ? "text-dp-text-tertiary italic" : "text-dp-text-secondary"}>{m.text}</span>
              </div>
              {!m.is_deleted && getAccessToken() && (
                <button type="button" disabled={reported.has(m.id)} onClick={() => void reportMessage(m)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-dp-text-tertiary hover:text-dp-accent-cta disabled:opacity-40" aria-label="Report message">
                  <Flag size={11} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-dp-border flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={getAccessToken() ? "Write a message…" : "Log in to chat"}
          disabled={!getAccessToken() || sending}
          maxLength={500}
          className="flex-1 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!getAccessToken() || sending || !text.trim()}
          className="px-3 py-2 bg-dp-accent-cta text-white rounded-sm disabled:opacity-50"
          aria-label="Send message"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
      {error && <p className="px-4 pb-2 text-[11px] text-dp-accent-cta">{error}</p>}
    </div>
  )
}
