"use client"

import React, { useCallback, useEffect, useState } from "react"
import { ExternalLink, Mail, RefreshCw, Trash2 } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type ContactMessage = {
  id: number
  reason: string
  first_name: string
  last_name: string
  email: string
  order_number: string
  message: string
  attachment: string
  created_at: string
}

export default function AdminContactMessagesPage(): React.ReactElement {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await adminFetch<ContactMessage[]>("/admin/contact-messages/")
      setMessages(Array.isArray(data) ? data : [])
    } catch {
      setError("Could not load contact messages.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function remove(message: ContactMessage) {
    if (!window.confirm(`Delete the message from ${message.email}?`)) return
    await adminFetch(`/admin/contact-messages/${message.id}/`, { method: "DELETE" })
    setMessages((all) => all.filter((item) => item.id !== message.id))
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-dp-text-primary">Contact Messages</h1>
          <p className="mt-1 text-[13px] text-dp-text-tertiary">Messages submitted through the public contact form.</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="Refresh contact messages" className="w-9 h-9 inline-flex items-center justify-center border border-dp-border rounded-sm text-dp-text-secondary hover:text-dp-text-primary">
          <RefreshCw size={15} />
        </button>
      </div>

      {error && <p role="alert" className="text-[12px] text-dp-accent-cta">{error}</p>}
      {loading ? (
        <div className="h-48 animate-pulse bg-dp-bg-elevated rounded-sm" />
      ) : messages.length === 0 ? (
        <div className="py-20 text-center border border-dp-border rounded-sm text-dp-text-tertiary">
          <Mail size={28} className="mx-auto mb-3" />
          <p className="text-[13px]">No contact messages yet.</p>
        </div>
      ) : (
        <div className="border border-dp-border rounded-sm divide-y divide-dp-border bg-dp-bg-surface">
          {messages.map((message) => (
            <article key={message.id} className="p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[14px] font-bold text-dp-text-primary">{message.first_name} {message.last_name}</h2>
                    <span className="text-[10px] uppercase tracking-widest text-dp-accent-cta">{message.reason}</span>
                  </div>
                  <a href={`mailto:${message.email}`} className="text-[12px] text-dp-text-secondary hover:text-dp-text-primary">{message.email}</a>
                  <p className="text-[11px] text-dp-text-tertiary">{new Date(message.created_at).toLocaleString()}{message.order_number ? ` | Order ${message.order_number}` : ""}</p>
                </div>
                <button type="button" onClick={() => void remove(message)} aria-label={`Delete message from ${message.email}`} className="w-8 h-8 inline-flex items-center justify-center text-dp-text-tertiary hover:text-dp-accent-cta">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-dp-text-secondary">{message.message}</p>
              {message.attachment && (
                <a href={message.attachment} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-[11px] text-dp-accent-cta hover:underline">
                  Open attachment <ExternalLink size={11} />
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
