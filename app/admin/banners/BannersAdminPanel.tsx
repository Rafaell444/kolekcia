"use client"

import React, { useEffect, useState } from "react"
import { Plus, Trash2, Bell, GripVertical, Save } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type AnnouncementBar = {
  id: number
  messages: string[]
  is_active: boolean
}

export default function BannersAdminPanel({ embedded = false }: { embedded?: boolean }) {
  const [bar, setBar] = useState<AnnouncementBar | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [newMsg, setNewMsg] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminFetch<AnnouncementBar>("/admin/announcement/")
      .then((d) => {
        setBar(d)
        setMessages(d.messages ?? [])
        setIsActive(d.is_active)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const updated = await adminFetch<AnnouncementBar>("/admin/announcement/", {
        method: "PATCH",
        body: JSON.stringify({ messages, is_active: isActive }),
      })
      setBar(updated)
      setMessages(updated.messages)
      setIsActive(updated.is_active)
    } catch {
      alert("Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  function addMessage() {
    const text = newMsg.trim()
    if (!text) return
    setMessages((prev) => [...prev, text])
    setNewMsg("")
  }

  function removeMessage(i: number) {
    setMessages((prev) => prev.filter((_, idx) => idx !== i))
  }

  function moveMessage(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= messages.length) return
    setMessages((prev) => {
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  return (
    <div className={embedded ? "flex flex-col gap-4" : "p-4 sm:p-8 flex flex-col gap-6"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Promo Banners</h1>
            <p className="text-[13px] text-dp-text-tertiary mt-1">Control the rotating top-of-page promo strip messages.</p>
          </div>
        )}
        {embedded && <p className="text-[13px] text-dp-text-tertiary">Rotating promo strip messages.</p>}
        <button type="button" onClick={() => { void save() }} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
          <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <label className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Show promo strip on website
      </label>

      {loading ? (
        <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-wrap items-center gap-3 px-4 py-4 rounded-sm border ${isActive ? "bg-dp-accent-cta/5 border-dp-accent-cta/30" : "bg-dp-bg-surface border-dp-border opacity-60"}`}>
              <GripVertical size={14} className="text-dp-text-tertiary shrink-0" />
              <Bell size={14} className={isActive ? "text-dp-accent-cta" : "text-dp-text-tertiary"} />
              <p className="flex-1 text-[13px] font-semibold text-dp-text-primary">{msg}</p>
              <div className="flex gap-1">
                <button type="button" onClick={() => moveMessage(i, -1)} disabled={i === 0} className="px-2 py-1 text-[10px] border border-dp-border rounded-sm disabled:opacity-30">Up</button>
                <button type="button" onClick={() => moveMessage(i, 1)} disabled={i === messages.length - 1} className="px-2 py-1 text-[10px] border border-dp-border rounded-sm disabled:opacity-30">Down</button>
                <button type="button" onClick={() => removeMessage(i)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors" aria-label="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No messages configured.</p>}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMessage() } }}
          placeholder="New promo message…"
          className="flex-1 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
        />
        <button type="button" onClick={addMessage} className="flex items-center gap-2 px-4 py-2 bg-dp-bg-surface border border-dp-border hover:border-dp-border-hover text-[12px] font-bold uppercase tracking-widest rounded-sm">
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
