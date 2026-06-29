"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { Send, MessageSquare, Loader2 } from "lucide-react"

type Message = { id: string; from_role: string; text: string; sent_at: string; read: boolean }
type Conversation = {
  id: string
  subject: string
  unread_count: number
  created_at: string
  customer_email: string
  customer_name: string
  vendor_name: string | null
  messages: Message[]
}

const POLL_INTERVAL = 3000

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return "just now"
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AdminInboxPage(): React.ReactElement {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const lastMsgCount = useRef<number>(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Load conversation list
  useEffect(() => {
    let cancelled = false
    adminFetch<Conversation[]>("/messaging/conversations/")
      .then((d) => {
        if (cancelled) return
        setConvs(d)
        if (d.length > 0) { setActiveId(d[0].id); lastMsgCount.current = d[0].messages?.length ?? 0 }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [activeId, convs])

  // Live poll active conversation
  const pollActive = useCallback(async () => {
    if (!activeId) return
    try {
      const full = await adminFetch<Conversation>(`/messaging/conversations/${activeId}/`)
      const newCount = full.messages?.length ?? 0
      if (newCount > lastMsgCount.current) {
        lastMsgCount.current = newCount
        setConvs((prev) => prev.map((c) => c.id === activeId ? full : c))
      }
    } catch { /* noop */ }
  }, [activeId])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!activeId) return
    pollRef.current = setInterval(() => { void pollActive() }, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeId, pollActive])

  async function openConv(id: string) {
    setActiveId(id)
    setDraft("")
    try {
      const full = await adminFetch<Conversation>(`/messaging/conversations/${id}/`)
      lastMsgCount.current = full.messages?.length ?? 0
      setConvs((prev) => prev.map((c) => c.id === id ? full : c))
    } catch { /* noop */ }
  }

  async function send() {
    const text = draft.trim()
    if (!text || !activeId) return
    setSending(true)
    try {
      const msg = await adminFetch<Message>(`/messaging/conversations/${activeId}/messages/`, {
        method: "POST",
        body: JSON.stringify({ text }),
      })
      setConvs((prev) => prev.map((c) => c.id === activeId ? { ...c, messages: [...(c.messages ?? []), msg] } : c))
      lastMsgCount.current += 1
      setDraft("")
    } catch { /* noop */ }
    finally { setSending(false) }
  }

  const active = convs.find((c) => c.id === activeId) ?? null
  const totalUnread = convs.reduce((s, c) => s + (c.unread_count ?? 0), 0)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-dp-border bg-dp-bg-surface shrink-0 flex items-center gap-3">
        <MessageSquare size={20} className="text-dp-accent-cta" />
        <h1 className="font-display text-3xl text-dp-text-primary">Inbox</h1>
        {totalUnread > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-dp-accent-cta text-white text-[10px] font-bold">
            {totalUnread} unread
          </span>
        )}
        <span className="ml-auto text-[11px] text-green-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
          Live
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-r border-dp-border bg-dp-bg-surface overflow-y-auto">
          {loading ? (
            <div className="animate-pulse p-4 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}
            </div>
          ) : convs.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare size={28} className="opacity-20 mx-auto mb-2" />
              <p className="text-[12px] text-dp-text-tertiary">No messages yet</p>
            </div>
          ) : (
            convs.map((c) => (
              <button
                key={c.id}
                onClick={() => openConv(c.id)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b border-dp-border hover:bg-dp-bg-base ${activeId === c.id ? "bg-dp-bg-base" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-[12px] truncate ${(c.unread_count ?? 0) > 0 ? "font-bold text-dp-text-primary" : "font-medium text-dp-text-secondary"}`}>
                      {c.customer_name || c.customer_email}
                    </p>
                    <span className="text-[9px] text-dp-text-tertiary shrink-0">{relTime(c.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-dp-text-tertiary truncate">{c.subject}</p>
                  {(c.unread_count ?? 0) > 0 && (
                    <span className="inline-block mt-1 px-1.5 rounded-full bg-dp-accent-cta text-white text-[9px] font-bold">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </aside>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {active ? (
            <>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-dp-border bg-dp-bg-surface shrink-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-dp-text-primary truncate">
                    {active.customer_name || active.customer_email}
                  </p>
                  <p className="text-[11px] text-dp-text-tertiary truncate">{active.subject}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 bg-dp-bg-base">
                {(active.messages ?? []).map((m) => (
                  <div key={m.id} className={`flex ${m.from_role === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-sm text-[13px] leading-relaxed ${
                      m.from_role === "admin"
                        ? "bg-dp-accent-cta text-white"
                        : "bg-dp-bg-elevated border border-dp-border text-dp-text-primary"
                    }`}>
                      {m.from_role !== "admin" && (
                        <p className="text-[10px] font-bold text-dp-text-tertiary mb-1 uppercase tracking-wider">
                          {active.customer_name || "Customer"}
                        </p>
                      )}
                      <p>{m.text}</p>
                      <p className={`text-[10px] mt-1 opacity-60 ${m.from_role === "admin" ? "text-right" : ""}`}>
                        {relTime(m.sent_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="px-6 py-4 border-t border-dp-border bg-dp-bg-surface shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); void send() }} className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send() } }}
                    rows={2}
                    placeholder="Reply to customer…"
                    className="flex-1 resize-none px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="w-10 h-10 self-end flex items-center justify-center bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white rounded-sm transition-colors"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-dp-text-tertiary">
              <p className="text-[13px]">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
