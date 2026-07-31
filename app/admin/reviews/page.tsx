"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Save, Star } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type HomepageReview = {
  id: number
  author_name: string
  author_initials: string
  rating: number
  review_date: string
  text: string
  google_review_id?: string | null
  google_review_url?: string
  source: "google" | "admin"
  sort_order: number
  is_active: boolean
}

type SocialLink = {
  id: number
  name: string
  url: string
  abbr: string
  bg_color: string
  text_color: string
  sort_order: number
  is_active: boolean
}

const inputCls = "w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1"

export default function AdminReviewsPage(): React.ReactElement {
  const [reviews, setReviews] = useState<HomepageReview[]>([])
  const [socials, setSocials] = useState<SocialLink[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSocialId, setSavingSocialId] = useState<number | null>(null)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([
        adminFetch<HomepageReview[]>("/admin/reviews/"),
        adminFetch<SocialLink[]>("/admin/community-links/"),
      ])
      setReviews(Array.isArray(r) ? r : [])
      setSocials(Array.isArray(s) ? s : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load().catch(() => setLoading(false)) }, [load])

  async function toggleReview(id: number, active: boolean) {
    const updated = await adminFetch<HomepageReview>(`/reviews/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: active }),
    })
    setReviews((prev) => prev.map((r) => r.id === id ? updated : r))
  }

  async function saveSocial(link: SocialLink) {
    setSavingSocialId(link.id)
    try {
      const updated = await adminFetch<SocialLink>(`/admin/community-links/${link.id}/`, {
        method: "PATCH",
        body: JSON.stringify(link),
      })
      setSocials((prev) => prev.map((s) => s.id === updated.id ? updated : s))
      setMessage(`${updated.name} link saved.`)
    } finally {
      setSavingSocialId(null)
    }
  }

  const googleReviews = reviews.filter((r) => r.source === "google")

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="font-display text-3xl text-dp-text-primary mb-2">Google Review Approvals</h1>
      <p className="text-[13px] text-dp-text-tertiary mb-8">Scraped Google reviews appear here for approval before they become visible on the homepage.</p>

      {message && <p className="mb-4 text-[12px] text-dp-accent-cta">{message}</p>}

      <section className="mb-12">
        <h2 className="font-display text-xl text-dp-text-primary mb-4">Incoming Google reviews</h2>
        {loading ? <p className="text-dp-text-tertiary text-[13px]">Loading...</p> : (
          <div className="space-y-3">
            {googleReviews.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 p-4 border border-dp-border rounded-sm bg-dp-bg-surface">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-dp-text-primary">{r.author_name}</p>
                    <span className="flex items-center gap-0.5 text-dp-accent-gold"><Star size={11} fill="currentColor" />{r.rating}</span>
                    {!r.is_active && <span className="text-[10px] uppercase text-dp-text-tertiary">Hidden</span>}
                  </div>
                  <p className="text-[12px] text-dp-text-tertiary mb-1">{r.review_date || "Google"} {r.google_review_id ? `· ${r.google_review_id}` : ""}</p>
                  <p className="text-[13px] text-dp-text-secondary line-clamp-3">{r.text}</p>
                  {r.google_review_url && <a href={r.google_review_url} target="_blank" rel="noreferrer" className="text-[11px] text-dp-accent-cta hover:underline">Open Google review</a>}
                </div>
                <button onClick={() => { void toggleReview(r.id, !r.is_active) }} className="px-3 py-1.5 border border-dp-accent-cta/40 text-dp-accent-cta rounded-sm text-[10px] font-bold uppercase shrink-0">{r.is_active ? "Hide" : "Approve"}</button>
              </div>
            ))}
            {googleReviews.length === 0 && (
              <p className="text-[13px] text-dp-text-tertiary">No scraped Google reviews yet. Run the Google review sync job to import requests.</p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl text-dp-text-primary mb-4">Community social links</h2>
        <p className="text-[12px] text-dp-text-tertiary mb-4">Put the destination URL for each fixed homepage platform. Leave the URL empty to hide that platform on the homepage.</p>

        <div className="space-y-3">
          {socials.map((s) => (
            <form key={s.id} onSubmit={(e) => { e.preventDefault(); void saveSocial(s) }} className="grid grid-cols-1 gap-3 p-4 border border-dp-border rounded-sm bg-dp-bg-surface md:grid-cols-[minmax(170px,220px)_1fr_auto] md:items-end">
              <div className="flex items-center gap-3 min-w-0 md:pb-1">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black" style={{ background: s.bg_color, color: s.text_color }}>{s.abbr}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-dp-text-primary">{s.name}</p>
                  <p className="text-[11px] text-dp-text-tertiary">{s.url.trim() ? "Visible when active" : "Hidden until URL is added"}</p>
                </div>
              </div>
              <div>
                <label className={labelCls}>URL</label>
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://"
                  value={s.url}
                  onChange={(e) => setSocials((prev) => prev.map((item) => item.id === s.id ? {
                    ...item,
                    url: e.target.value,
                    is_active: Boolean(e.target.value.trim()),
                  } : item))}
                />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={savingSocialId === s.id} className="inline-flex items-center gap-1 px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm disabled:opacity-50">
                  <Save size={12} /> {savingSocialId === s.id ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  )
}
