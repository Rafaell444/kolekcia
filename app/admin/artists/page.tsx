"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { CheckCircle, Pencil, X } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"
import AdminMediaUpload from "@/components/admin/AdminMediaUpload"

type AdminArtist = {
  id: number; name: string; handle: string; avatar_url: string; cover_url: string
  verified: boolean; level: number; badge: string
}

const BADGE_COLOR: Record<string, string> = {
  Diamond: "bg-sky-400/20 text-sky-300 border-sky-400/40",
  Platinum: "bg-slate-400/20 text-slate-300 border-slate-400/40",
  Gold:    "bg-dp-accent-gold/20 text-dp-accent-gold border-dp-accent-gold/40",
  Silver:  "bg-slate-500/20 text-slate-400 border-slate-500/40",
  Bronze:  "bg-orange-500/20 text-orange-300 border-orange-500/40",
}

export default function AdminArtistsPage(): React.ReactElement {
  const [artists, setArtists] = useState<AdminArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminArtist | null>(null)
  const [form, setForm] = useState({ avatar_url: "", cover_url: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    adminFetch<AdminArtist[] | PaginatedResponse<AdminArtist>>("/admin/artists/")
      .then((d) => { if (!cancelled) setArtists(parseList(d)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggleVerified(id: number) {
    const res = await adminFetch<AdminArtist>(`/admin/artists/${id}/`, { method: "PATCH", body: JSON.stringify({ verified: !artists.find((a) => a.id === id)?.verified }) }).catch(() => null)
    if (res) setArtists((prev) => prev.map((a) => a.id === id ? { ...a, verified: res.verified } : a))
  }

  function openEdit(a: AdminArtist) {
    setEditing(a)
    setForm({ avatar_url: a.avatar_url ?? "", cover_url: a.cover_url ?? "" })
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const updated = await adminFetch<AdminArtist>(`/admin/artists/${editing.id}/`, {
        method: "PATCH",
        body: JSON.stringify(form),
      })
      setArtists((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...updated } : a)))
      setEditing(null)
    } catch {
      alert("Failed to save artist.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Artists</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Review artist profiles, verify accounts, and manage payout tiers.</p>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3].map((i) => <div key={i} className="h-48 bg-dp-bg-elevated rounded-sm" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((a) => (
            <div key={a.id} className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
              <div className="relative h-24 bg-dp-bg-elevated">
                {a.cover_url && <Image src={a.cover_url} alt="" fill className="object-cover opacity-50" sizes="(max-width: 640px) 100vw, 33vw" />}
              </div>
              <div className="px-4 pb-4 -mt-6 relative">
                <div className="relative w-12 h-12 rounded-full border-2 border-dp-bg-surface overflow-hidden mb-2">
                  {a.avatar_url && <Image src={a.avatar_url} alt={a.name} fill className="object-cover" sizes="48px" />}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display text-lg text-dp-text-primary">{a.name}</p>
                  {a.verified && <CheckCircle size={14} className="text-dp-accent-cta" />}
                </div>
                <p className="text-[11px] text-dp-text-tertiary mb-3">@{a.handle} · Level {a.level}</p>
                <div className="flex items-center justify-between">
                  {a.badge ? (
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${BADGE_COLOR[a.badge] ?? ""}`}>{a.badge}</span>
                  ) : <span />}
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Edit"><Pencil size={12} /></button>
                    <button onClick={() => toggleVerified(a.id)} className={`w-7 h-7 flex items-center justify-center rounded-sm border transition-colors ${a.verified ? "border-dp-success/40 text-dp-success" : "border-dp-border text-dp-text-tertiary hover:text-dp-text-primary"}`} aria-label="Toggle verified">
                      <CheckCircle size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">Edit {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-dp-text-tertiary hover:text-dp-text-primary"><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} className="p-5 flex flex-col gap-4">
              <AdminMediaUpload label="Avatar" previewUrl={form.avatar_url} folder="artists" onUploaded={(url) => setForm((f) => ({ ...f, avatar_url: url }))} previewClassName="w-16 h-16 rounded-full" />
              <AdminMediaUpload label="Cover" previewUrl={form.cover_url} folder="artists" onUploaded={(url) => setForm((f) => ({ ...f, cover_url: url }))} previewClassName="w-full h-24" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
