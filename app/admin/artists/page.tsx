"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { CheckCircle, Pencil } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"

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

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">Artists</h1>
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
                    <button className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Edit"><Pencil size={12} /></button>
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
    </div>
  )
}
