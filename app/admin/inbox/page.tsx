"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { adminFetch } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"
import { productHref } from "@/lib/product-url"
import { notifyInboxRead } from "@/components/messaging/UnreadBadge"
import { Send, MessageSquare, Loader2, Paperclip, X, Play } from "lucide-react"
import { getAdminToken, getAdminUser, refreshAdminToken } from "@/lib/admin-auth"
import { useChatSocket, useNotificationSocket, type ChatWsEvent } from "@/hooks/use-messaging-ws"

type Attachment = { id: string; url: string; media_type: string; original_name: string }
type Message = {
  id: string
  from_role: string
  sender_kind?: string
  sender_label?: string | null
  text: string
  sent_at: string
  read: boolean
  attachments: Attachment[]
}
type Conversation = {
  id: string
  subject: string
  unread_count: number
  created_at: string
  customer_email: string
  customer_name: string
  vendor_name: string | null
  shop_label?: string | null
  product_id: number | null
  product_slug: string | null
  product_title: string | null
  product_image_url: string | null
  messages: Message[]
}

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return "just now"
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function AttachmentPreview({ att }: { att: Attachment }) {
  if (att.media_type === "image") {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.url}
          alt={att.original_name}
          className="max-w-[220px] max-h-[200px] rounded-sm object-cover border border-white/20"
        />
      </a>
    )
  }
  if (att.media_type === "video") {
    return (
      <video src={att.url} controls className="max-w-[260px] max-h-[180px] rounded-sm" />
    )
  }
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-sm text-[12px] underline">
      <Paperclip size={12} /> {att.original_name}
    </a>
  )
}

export default function AdminInboxPage(): React.ReactElement {
  const searchParams = useSearchParams()
  const [convs, setConvs]       = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft]       = useState("")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const endRef      = useRef<HTMLDivElement>(null)
  const lastMsgCount = useRef<number>(0)
  const activeIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openedFromUrl = useRef(false)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  function applyOpenedConv(full: Conversation, id: string) {
    lastMsgCount.current = full.messages?.length ?? 0
    setConvs((prev) => prev.map((c) => (c.id === id ? { ...full, unread_count: 0 } : c)))
    notifyInboxRead()
  }

  const loadList = useCallback(async () => {
    try {
      const raw = await adminFetch<Conversation[] | PaginatedResponse<Conversation>>("/messaging/conversations/")
      const data = parseList(raw)
      const currentActiveId = activeIdRef.current
      setConvs((prev) => {
        const prevActive = currentActiveId ? prev.find((c) => c.id === currentActiveId) : null
        return data.map((c) => {
          if (c.id === currentActiveId && prevActive?.messages?.length) {
            return { ...prevActive, unread_count: 0 }
          }
          return c
        })
      })
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    adminFetch<Conversation[] | PaginatedResponse<Conversation>>("/messaging/conversations/")
      .then((raw) => { if (cancelled) return; setConvs(parseList(raw)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleNotif = useCallback(() => {
    void loadList()
  }, [loadList])

  useNotificationSocket(getAdminToken, refreshAdminToken, handleNotif)

  const handleChatWs = useCallback((event: ChatWsEvent) => {
    if (event.type === "new_message" && event.message) {
      setConvs((prev) => prev.map((c) =>
        c.id === activeIdRef.current
          ? { ...c, messages: [...(c.messages ?? []), event.message as unknown as Message] }
          : c
      ))
      lastMsgCount.current += 1
    }
  }, [])

  useChatSocket(activeId, getAdminToken, refreshAdminToken, handleChatWs)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [activeId, convs])

  async function openConv(id: string | number) {
    const sid = String(id)
    setActiveId(sid)
    setDraft("")
    setPendingFiles([])
    try {
      const full = await adminFetch<Conversation>(`/messaging/conversations/${sid}/`)
      applyOpenedConv(full, sid)
      setConvs((prev) => {
        if (prev.some((c) => String(c.id) === sid)) {
          return prev.map((c) => (String(c.id) === sid ? { ...full, unread_count: 0 } : c))
        }
        return [{ ...full, id: sid, unread_count: 0 }, ...prev]
      })
    } catch { /* noop */ }
  }

  // Open conversation from ?c= query (e.g. from Customers → Message)
  useEffect(() => {
    const convId = searchParams.get("c")
    if (!convId || openedFromUrl.current) return
    openedFromUrl.current = true
    void openConv(convId)
  }, [searchParams])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPendingFiles((prev) => [...prev, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function send() {
    const text = draft.trim()
    if ((!text && pendingFiles.length === 0) || !activeId) return
    setSending(true)
    try {
      let msg: Message
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const token = getAdminToken()

      if (pendingFiles.length > 0) {
        const form = new FormData()
        form.append("text", text)
        pendingFiles.forEach((f) => form.append("files", f))
        const res = await fetch(`${base}/messaging/conversations/${activeId}/messages/`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        })
        msg = await res.json() as Message
      } else {
        msg = await adminFetch<Message>(`/messaging/conversations/${activeId}/messages/`, {
          method: "POST",
          body: JSON.stringify({ text }),
        })
      }

      setConvs((prev) => prev.map((c) =>
        c.id === activeId ? { ...c, messages: [...(c.messages ?? []), msg] } : c
      ))
      lastMsgCount.current += 1
      setDraft("")
      setPendingFiles([])
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }))
    } catch { /* noop */ }
    finally { setSending(false) }
  }

  const active = convs.find((c) => String(c.id) === activeId) ?? null
  const totalUnread = convs.reduce((s, c) => s + (c.unread_count ?? 0), 0)
  const isSuperadmin = getAdminUser()?.vendor == null

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] lg:h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 border-b border-dp-border bg-dp-bg-surface shrink-0 flex items-center gap-3">
        <MessageSquare size={20} className="text-dp-accent-cta" />
        <h1 className="font-display text-2xl sm:text-3xl text-dp-text-primary">Inbox</h1>
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

      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
        {/* Sidebar — full width on mobile when no chat selected */}
        <aside className={`sm:w-72 shrink-0 border-r border-dp-border bg-dp-bg-surface overflow-y-auto ${activeId ? "hidden sm:block" : "block"}`}>
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
                  {isSuperadmin && c.shop_label && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded-sm bg-dp-bg-elevated border border-dp-border text-[9px] font-bold uppercase tracking-wider text-dp-text-secondary">
                      {c.shop_label}
                    </span>
                  )}
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
        <div className={`flex-1 flex flex-col overflow-hidden ${activeId ? "flex" : "hidden sm:flex"}`}>
          {active ? (
            <>
              {/* Conversation header */}
              <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-dp-border bg-dp-bg-surface shrink-0">
                <button
                  onClick={() => setActiveId(null)}
                  className="sm:hidden mr-1 text-dp-text-secondary hover:text-dp-text-primary transition-colors"
                  aria-label="Back to conversations"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-dp-text-primary truncate">
                    {active.customer_name || active.customer_email}
                  </p>
                  <p className="text-[11px] text-dp-text-tertiary truncate">{active.subject}</p>
                  {isSuperadmin && active.shop_label && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-sm bg-dp-accent-cta/10 border border-dp-accent-cta/30 text-[10px] font-bold uppercase tracking-wider text-dp-accent-cta">
                      {active.shop_label} shop
                    </span>
                  )}
                </div>
              </div>

              {/* Product context */}
              {active.product_id && active.product_title && (
                <div className="px-6 py-3 border-b border-dp-border bg-dp-bg-elevated/60 shrink-0">
                  <Link
                    href={productHref({ id: active.product_id, slug: active.product_slug ?? undefined })}
                    className="flex items-center gap-3 hover:opacity-90 transition-opacity"
                  >
                    {active.product_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={active.product_image_url} alt={active.product_title} className="w-10 h-12 rounded-sm object-cover border border-dp-border" />
                    ) : (
                      <div className="w-10 h-12 rounded-sm border border-dp-border bg-dp-bg-base" />
                    )}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary">Product context</p>
                      <p className="text-[12px] font-semibold text-dp-text-primary">{active.product_title}</p>
                    </div>
                  </Link>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 bg-dp-bg-base">
                {(active.messages ?? []).map((m) => {
                  const isAdmin = m.from_role === "admin"
                  const hasText = Boolean(m.text?.trim())
                  const attachments = m.attachments ?? []
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-sm text-[13px] leading-relaxed ${
                        isAdmin
                          ? "bg-dp-accent-cta text-white"
                          : "bg-dp-bg-elevated border border-dp-border text-dp-text-primary"
                      }`}>
                        {!isAdmin && (
                          <p className="text-[10px] font-bold text-dp-text-tertiary mb-1 uppercase tracking-wider">
                            {active.customer_name || "Customer"}
                          </p>
                        )}
                        {isAdmin && isSuperadmin && m.sender_label && (
                          <p className="text-[10px] font-bold mb-1 uppercase tracking-wider opacity-80">
                            {m.sender_label}
                          </p>
                        )}
                        {hasText && <p className="mb-1">{m.text}</p>}
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {attachments.map((att) => (
                              <AttachmentPreview key={att.id} att={att} />
                            ))}
                          </div>
                        )}
                        {!hasText && attachments.length === 0 && (
                          <p className="opacity-40 italic text-[12px]">(empty message)</p>
                        )}
                        <p className={`text-[10px] mt-1 opacity-60 ${isAdmin ? "text-right" : ""}`}>
                          {relTime(m.sent_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              {/* Compose area */}
              <div className="px-4 py-3 border-t border-dp-border bg-dp-bg-surface shrink-0">
                {/* Pending file chips */}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-dp-bg-elevated border border-dp-border rounded-sm text-[11px] text-dp-text-secondary">
                        {f.type.startsWith("video/") ? <Play size={10} /> : <Paperclip size={10} />}
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="text-dp-text-tertiary hover:text-red-400 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <form onSubmit={(e) => { e.preventDefault(); void send() }} className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 w-9 h-9 flex items-center justify-center border border-dp-border rounded-sm text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
                    aria-label="Attach file"
                  >
                    <Paperclip size={15} />
                  </button>
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
                    disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
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
