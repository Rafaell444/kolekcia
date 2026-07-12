"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, X, Star } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type HomepageReview = {
  id: number
  author_name: string
  author_initials: string
  rating: number
  review_date: string
  text: string
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

const EMPTY_REVIEW: Omit<HomepageReview, "id"> = {
  author_name: "",
  author_initials: "",
  rating: 5,
  review_date: "",
  text: "",
  source: "admin",
  sort_order: 0,
  is_active: true,
}

const EMPTY_SOCIAL: Omit<SocialLink, "id"> = {
  name: "",
  url: "",
  abbr: "",
  bg_color: "#000000",
  text_color: "#ffffff",
  sort_order: 0,
  is_active: true,
}

export default function AdminReviewsPage(): React.ReactElement {
  const [reviews, setReviews] = useState<HomepageReview[]>([])
  const [socials, setSocials] = useState<SocialLink[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewForm, setReviewForm] = useState<Omit<HomepageReview, "id"> | null>(null)
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null)
  const [socialForm, setSocialForm] = useState<Omit<SocialLink, "id"> | null>(null)
  const [editingSocialId, setEditingSocialId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([
        adminFetch<HomepageReview[]>("/reviews/"),
        adminFetch<SocialLink[]>("/community-links/"),
      ])
      setReviews(Array.isArray(r) ? r : [])
      setSocials(Array.isArray(s) ? s : [])
    } catch {
      // keep empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveReview(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewForm) return
    if (editingReviewId) {
      await adminFetch(`/reviews/${editingReviewId}/`, { method: "PATCH", body: JSON.stringify(reviewForm) })
    } else {
      await adminFetch("/reviews/", { method: "POST", body: JSON.stringify(reviewForm) })
    }
    setReviewForm(null)
    setEditingReviewId(null)
    await load()
  }

  async function deleteReview(id: number) {
    await adminFetch(`/reviews/${id}/`, { method: "DELETE" })
    await load()
  }

  async function saveSocial(e: React.FormEvent) {
    e.preventDefault()
    if (!socialForm) return
    if (editingSocialId) {
      await adminFetch(`/community-links/${editingSocialId}/`, { method: "PATCH", body: JSON.stringify(socialForm) })
    } else {
      await adminFetch("/community-links/", { method: "POST", body: JSON.stringify(socialForm) })
    }
    setSocialForm(null)
    setEditingSocialId(null)
    await load()
  }

  async function deleteSocial(id: number) {
    await adminFetch(`/community-links/${id}/`, { method: "DELETE" })
    await load()
  }

  const inputCls = "w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
  const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1"

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="font-display text-3xl text-dp-text-primary mb-2">Homepage Reviews</h1>
      <p className="text-[13px] text-dp-text-tertiary mb-8">Manage customer testimonials and community social links shown on the homepage.</p>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-dp-text-primary">Reviews</h2>
          <button onClick={() => { setReviewForm(EMPTY_REVIEW); setEditingReviewId(null) }} className="flex items-center gap-1 px-3 py-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest rounded-sm">
            <Plus size={12} /> Add Review
          </button>
        </div>

        {reviewForm && (
          <form onSubmit={saveReview} className="mb-6 p-5 border border-dp-border rounded-sm bg-dp-bg-surface grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Author name</label><input required className={inputCls} value={reviewForm.author_name} onChange={(e) => setReviewForm((f) => f ? { ...f, author_name: e.target.value } : f)} /></div>
            <div><label className={labelCls}>Initials</label><input className={inputCls} value={reviewForm.author_initials} onChange={(e) => setReviewForm((f) => f ? { ...f, author_initials: e.target.value } : f)} /></div>
            <div><label className={labelCls}>Date label</label><input className={inputCls} placeholder="June 2024" value={reviewForm.review_date} onChange={(e) => setReviewForm((f) => f ? { ...f, review_date: e.target.value } : f)} /></div>
            <div><label className={labelCls}>Rating</label><input type="number" min={1} max={5} className={inputCls} value={reviewForm.rating} onChange={(e) => setReviewForm((f) => f ? { ...f, rating: parseInt(e.target.value, 10) } : f)} /></div>
            <div><label className={labelCls}>Source</label><select className={inputCls} value={reviewForm.source} onChange={(e) => setReviewForm((f) => f ? { ...f, source: e.target.value as "google" | "admin" } : f)}><option value="google">Google</option><option value="admin">Staff Pick</option></select></div>
            <div><label className={labelCls}>Sort order</label><input type="number" className={inputCls} value={reviewForm.sort_order} onChange={(e) => setReviewForm((f) => f ? { ...f, sort_order: parseInt(e.target.value, 10) } : f)} /></div>
            <div className="col-span-2"><label className={labelCls}>Review text</label><textarea required rows={3} className={inputCls} value={reviewForm.text} onChange={(e) => setReviewForm((f) => f ? { ...f, text: e.target.value } : f)} /></div>
            <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={reviewForm.is_active} onChange={(e) => setReviewForm((f) => f ? { ...f, is_active: e.target.checked } : f)} /> Active on homepage</label>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm">Save</button>
              <button type="button" onClick={() => { setReviewForm(null); setEditingReviewId(null) }} className="px-4 py-2 border border-dp-border text-[11px] font-bold uppercase rounded-sm"><X size={12} className="inline" /> Cancel</button>
            </div>
          </form>
        )}

        {loading ? <p className="text-dp-text-tertiary text-[13px]">Loading…</p> : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 p-4 border border-dp-border rounded-sm bg-dp-bg-surface">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-dp-text-primary">{r.author_name}</p>
                    <span className="flex items-center gap-0.5 text-dp-accent-gold"><Star size={11} fill="currentColor" />{r.rating}</span>
                    {!r.is_active && <span className="text-[10px] uppercase text-dp-text-tertiary">Hidden</span>}
                  </div>
                  <p className="text-[12px] text-dp-text-tertiary mb-1">{r.review_date} · {r.source}</p>
                  <p className="text-[13px] text-dp-text-secondary line-clamp-2">{r.text}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setReviewForm({ ...r }); setEditingReviewId(r.id) }} className="p-2 border border-dp-border rounded-sm"><Pencil size={13} /></button>
                  <button onClick={() => deleteReview(r.id)} className="p-2 border border-dp-border rounded-sm text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-dp-text-primary">Join our Community links</h2>
          <button onClick={() => { setSocialForm(EMPTY_SOCIAL); setEditingSocialId(null) }} className="flex items-center gap-1 px-3 py-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest rounded-sm">
            <Plus size={12} /> Add Link
          </button>
        </div>

        {socialForm && (
          <form onSubmit={saveSocial} className="mb-6 p-5 border border-dp-border rounded-sm bg-dp-bg-surface grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Platform name</label><input required className={inputCls} value={socialForm.name} onChange={(e) => setSocialForm((f) => f ? { ...f, name: e.target.value } : f)} /></div>
            <div><label className={labelCls}>URL</label><input required type="url" className={inputCls} placeholder="https://" value={socialForm.url} onChange={(e) => setSocialForm((f) => f ? { ...f, url: e.target.value } : f)} /></div>
            <div><label className={labelCls}>Abbreviation</label><input required className={inputCls} value={socialForm.abbr} onChange={(e) => setSocialForm((f) => f ? { ...f, abbr: e.target.value } : f)} /></div>
            <div><label className={labelCls}>Sort order</label><input type="number" className={inputCls} value={socialForm.sort_order} onChange={(e) => setSocialForm((f) => f ? { ...f, sort_order: parseInt(e.target.value, 10) } : f)} /></div>
            <div><label className={labelCls}>Background color</label><input className={inputCls} value={socialForm.bg_color} onChange={(e) => setSocialForm((f) => f ? { ...f, bg_color: e.target.value } : f)} /></div>
            <div><label className={labelCls}>Text color</label><input className={inputCls} value={socialForm.text_color} onChange={(e) => setSocialForm((f) => f ? { ...f, text_color: e.target.value } : f)} /></div>
            <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={socialForm.is_active} onChange={(e) => setSocialForm((f) => f ? { ...f, is_active: e.target.checked } : f)} /> Active</label>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm">Save</button>
              <button type="button" onClick={() => { setSocialForm(null); setEditingSocialId(null) }} className="px-4 py-2 border border-dp-border text-[11px] font-bold uppercase rounded-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {socials.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 p-4 border border-dp-border rounded-sm bg-dp-bg-surface">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black" style={{ background: s.bg_color, color: s.text_color }}>{s.abbr}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-dp-text-primary">{s.name}</p>
                  <p className="text-[12px] text-dp-text-tertiary truncate">{s.url}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setSocialForm({ ...s }); setEditingSocialId(s.id) }} className="p-2 border border-dp-border rounded-sm"><Pencil size={13} /></button>
                <button onClick={() => deleteSocial(s.id)} className="p-2 border border-dp-border rounded-sm text-red-400"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
