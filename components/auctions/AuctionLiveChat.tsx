"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { MessageSquare, Send, Loader2 } from "lucide-react"
import { apiFetch, authFetch, getApiErrorMessage } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"

type ChatMessage = {
  id: number
  user_name: string
  text: string
  created_at: string
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

    const token = getAccessToken()
    if (!token) return

    const ws = new WebSocket(`${wsBaseUrl()}/ws/auctions/${auctionId}/?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ChatMessage
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      } catch {
        // ignore malformed frames
      }
    }

    ws.onerror = () => {
      // REST fallback still works for send
    }

    return () => {
      ws.close()
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
      const viaWs = wsRef.current?.readyState === WebSocket.OPEN
      if (viaWs) {
        wsRef.current?.send(JSON.stringify({ text: trimmed }))
        setText("")
      } else {
        const msg = await authFetch<ChatMessage>(`/auctions/${auctionId}/chat/`, {
          method: "POST",
          body: JSON.stringify({ text: trimmed }),
        })
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        setText("")
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send message."))
    } finally {
      setSending(false)
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
            <div key={m.id} className="text-[12px]">
              <span className="font-semibold text-dp-text-primary">{m.user_name}</span>
              <span className="text-dp-text-tertiary mx-1.5">·</span>
              <span className="text-dp-text-secondary">{m.text}</span>
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
