"use client"

import React, { useEffect, useState } from "react"
import { Plus, Trash2, Bell } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Banner = { id: string; title: string; subtitle: string; is_active: boolean }

export default function AdminBannersPage(): React.ReactElement {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminFetch<Banner[]>("/admin/banners/")
      .then((d) => { if (!cancelled) setBanners(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggleBanner(id: string, is_active: boolean) {
    const res = await adminFetch<Banner>(`/admin/banners/${id}/`, { method: "PATCH", body: JSON.stringify({ is_active }) }).catch(() => null)
    if (res) setBanners((prev) => prev.map((b) => b.id === id ? { ...b, is_active: res.is_active } : b))
  }

  async function deleteBanner(id: string) {
    await adminFetch(`/admin/banners/${id}/`, { method: "DELETE" }).catch(() => {})
    setBanners((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl text-dp-text-primary">Promo Banners</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Control the rotating top-of-page promo strip messages.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
          <Plus size={14} /> Add Banner
        </button>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {banners.map((b) => (
            <div key={b.id} className={`flex items-center gap-4 px-5 py-4 rounded-sm border ${b.is_active ? "bg-dp-accent-cta/5 border-dp-accent-cta/30" : "bg-dp-bg-surface border-dp-border opacity-60"}`}>
              <Bell size={14} className={b.is_active ? "text-dp-accent-cta" : "text-dp-text-tertiary"} />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-dp-text-primary">{b.title}</p>
                {b.subtitle && <p className="text-[11px] text-dp-text-tertiary">{b.subtitle}</p>}
              </div>
              <button onClick={() => toggleBanner(b.id, !b.is_active)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm border transition-colors ${b.is_active ? "border-dp-accent-cta/30 text-dp-accent-cta" : "border-dp-border text-dp-text-tertiary"}`}>
                {b.is_active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => deleteBanner(b.id)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors" aria-label="Delete">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {banners.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No banners configured.</p>}
        </div>
      )}
    </div>
  )
}
