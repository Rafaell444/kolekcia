"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { authFetch, parseList, type PaginatedResponse } from "@/lib/api"
import { productHref } from "@/lib/product-url"
import { Send, MessageSquare, ChevronLeft, Loader2 } from "lucide-react"

export type InboxMessage = { id: string; from_role: string; text: string; sent_at: string; read: boolean }
export type InboxConversation = {
  id: string
  subject: string
  vendor_name: string | null
  vendor_slug: string | null
  product_id: number | null
  product_slug: string | null
  product_title: string | null
  product_image_url: string | null
  unread_count: number
  created_at: string
  messages: InboxMessage[]
}

const POLL_INTERVAL = 3000

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function ChatWindow({
  conv,
  onBack,
  onNewMessages,
}: {
  conv: InboxConversation
  onBack: () => void
  onNewMessages: (msgs: InboxMessage[], id: string) => void
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const lastMsgCount = useRef(conv.messages.length)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    lastMsgCount.current = conv.messages.length
  }, [conv.id])

  const poll = useCallback(async () => {
    try {
      const full = await authFetch<InboxConversation>(`/messaging/conversations/${conv.id}/`)
      if (full.messages.length > lastMsgCount.current) {
        lastMsgCount.current = full.messages.length
        onNewMessages(full.messages, conv.id)
      }
    } catch { /* noop */ }
  }, [conv.id, onNewMessages])

  useEffect(() => {
    lastMsgCount.current = conv.messages.length
    pollRef.current = setInterval(() => { void poll() }, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [conv.id, poll])

  async function send() {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      const msg = await authFetch<InboxMessage>(`/messaging/conversations/${conv.id}/messages/`, {
        method: "POST",
        body: JSON.stringify({ text }),
      })
      onNewMessages([...conv.messages, msg], conv.id)
      lastMsgCount.current = conv.messages.length + 1
      setDraft("")
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }))
    } catch { /* noop */ }
    finally { setSending(false) }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-dp-border bg-dp-bg-surface shrink-0">
        <button type="button" onClick={onBack} className="md:hidden text-dp-text-secondary hover:text-dp-text-primary transition-colors" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-dp-text-primary leading-tight truncate">{conv.subject}</p>
          {conv.vendor_name && (
            <p className="text-[11px] text-dp-text-tertiary">
              {conv.vendor_name} · <span className="text-green-400">Live</span>
            </p>
          )}
        </div>
      </div>
      {conv.product_id && conv.product_title && (
        <div className="px-4 sm:px-5 py-3 border-b border-dp-border bg-dp-bg-elevated/60">
          <Link
            href={productHref({ id: conv.product_id, slug: conv.product_slug ?? undefined })}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            {conv.product_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={conv.product_image_url} alt={conv.product_title} className="w-10 h-12 rounded-sm object-cover border border-dp-border" />
            ) : (
              <div className="w-10 h-12 rounded-sm border border-dp-border bg-dp-bg-base" />
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary">Product context</p>
              <p className="text-[12px] font-semibold text-dp-text-primary">{conv.product_title}</p>
            </div>
          </Link>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 sm:py-5 flex flex-col gap-3 bg-dp-bg-base">
        {(conv.messages ?? []).map((m) => {
          const isOwn = m.from_role === "customer"
          return (
            <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-sm text-[13px] leading-relaxed ${
                isOwn
                  ? "bg-dp-accent-cta text-white"
                  : "bg-dp-bg-elevated border border-dp-border text-dp-text-primary"
              }`}>
                {!isOwn && conv.vendor_name && (
                  <p className="text-[10px] font-bold text-dp-text-tertiary mb-1 uppercase tracking-wider">{conv.vendor_name}</p>
                )}
                <p>{m.text}</p>
                <p className={`text-[10px] mt-1 opacity-60 ${isOwn ? "text-right" : ""}`}>{relTime(m.sent_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="px-3 sm:px-4 py-3 border-t border-dp-border bg-dp-bg-surface shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); void send() }} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send() } }}
            placeholder="Type a message…"
            rows={2}
            className="flex-1 resize-none px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors min-w-0"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="shrink-0 w-10 h-10 flex items-center justify-center bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white rounded-sm transition-colors"
            aria-label="Send"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function InboxPanel({
  initialConvId = null,
  autoSelectFirst = true,
  embedded = false,
}: {
  initialConvId?: string | null
  autoSelectFirst?: boolean
  embedded?: boolean
}) {
  const [convs, setConvs] = useState<InboxConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadList = useCallback(async () => {
    try {
      const raw = await authFetch<InboxConversation[] | PaginatedResponse<InboxConversation>>("/messaging/conversations/")
      const data = parseList(raw)
      setConvs(data)
      return data
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadList()
      .then((data) => {
        if (cancelled) return
        if (initialConvId) {
          setActiveId(initialConvId)
          const alreadyInList = data.some((c) => String(c.id) === String(initialConvId))
          if (!alreadyInList) {
            authFetch<InboxConversation>(`/messaging/conversations/${initialConvId}/`)
              .then((full) => {
                if (!cancelled) {
                  setConvs((prev) => {
                    const filtered = prev.filter((c) => String(c.id) !== String(full.id))
                    return [full, ...filtered]
                  })
                }
              })
              .catch(() => {})
          }
        } else if (autoSelectFirst && data.length > 0) {
          const isDesktop = window.matchMedia("(min-width: 768px)").matches
          if (isDesktop) setActiveId(String(data[0].id))
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [loadList, initialConvId, autoSelectFirst])

  async function openConv(id: string) {
    setActiveId(id)
    try {
      const full = await authFetch<InboxConversation>(`/messaging/conversations/${id}/`)
      setConvs((prev) => prev.map((c) => String(c.id) === String(id) ? { ...full, unread_count: 0 } : c))
    } catch { /* noop */ }
  }

  function handleNewMessages(messages: InboxMessage[], convId: string) {
    setConvs((prev) => prev.map((c) => String(c.id) === String(convId) ? { ...c, messages } : c))
  }

  const active = convs.find((c) => String(c.id) === String(activeId)) ?? null
  const panelStyle = embedded
    ? { minHeight: "480px", height: "65vh" }
    : { height: "calc(100vh - 220px)", minHeight: "500px" }

  return (
    <div
      className={`flex border border-dp-border overflow-hidden bg-dp-bg-surface ${embedded ? "rounded-sm" : "border-x"}`}
      style={panelStyle}
    >
      <aside className={`w-full md:w-80 xl:w-96 shrink-0 border-r border-dp-border flex flex-col bg-dp-bg-surface overflow-y-auto min-h-0 ${active ? "hidden md:flex" : "flex"}`}>
        <div className="px-4 py-3 border-b border-dp-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">
            Conversations ({convs.length})
          </p>
        </div>

        {loading ? (
          <div className="animate-pulse p-4 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-dp-bg-elevated rounded-sm" />)}
          </div>
        ) : convs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-dp-text-tertiary px-6 text-center py-12">
            <MessageSquare size={32} className="opacity-25" />
            <p className="text-[12px]">No conversations yet</p>
            <p className="text-[11px] text-dp-text-tertiary">
              Visit an artist page and click &ldquo;Contact Artist&rdquo; to start one.
            </p>
          </div>
        ) : (
          convs.map((conv) => (
            <button
              key={String(conv.id)}
              type="button"
              onClick={() => openConv(String(conv.id))}
              className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b border-dp-border hover:bg-dp-bg-elevated ${String(activeId) === String(conv.id) ? "bg-dp-bg-elevated" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[13px] truncate ${(conv.unread_count ?? 0) > 0 ? "font-bold text-dp-text-primary" : "font-medium text-dp-text-secondary"}`}>
                    {conv.subject}
                  </p>
                  <span className="text-[10px] text-dp-text-tertiary shrink-0">{relTime(conv.created_at)}</span>
                </div>
                {conv.vendor_name && (
                  <p className="text-[11px] text-dp-text-tertiary truncate">{conv.vendor_name}</p>
                )}
                {conv.product_title && (
                  <p className="text-[11px] text-dp-text-tertiary truncate">Product: {conv.product_title}</p>
                )}
                {(conv.unread_count ?? 0) > 0 && (
                  <span className="inline-block mt-1 px-1.5 rounded-full bg-dp-accent-cta text-white text-[9px] font-bold">
                    {conv.unread_count} new
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </aside>

      <main className={`flex-1 min-w-0 min-h-0 ${active ? "flex" : "hidden md:flex"} flex-col bg-dp-bg-base`}>
        {active ? (
          <ChatWindow conv={active} onBack={() => setActiveId(null)} onNewMessages={handleNewMessages} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-dp-text-tertiary">
            <MessageSquare size={40} className="opacity-30" />
            <p className="text-[13px] font-medium">Select a conversation to open it</p>
          </div>
        )}
      </main>
    </div>
  )
}
