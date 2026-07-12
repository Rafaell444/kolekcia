"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { Play, ImageIcon, GripVertical, Pencil, Plus, Trash2, X, ChevronUp, ChevronDown } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import AdminMediaUpload from "@/components/admin/AdminMediaUpload"

type HeroSlide = {
  id: string
  type: "image" | "video"
  image_url: string
  video_url: string
  video_poster_url: string
  headline: string
  subline: string
  cta: string
  cta_href: string
  order: number
  is_active: boolean
}

const EMPTY: Omit<HeroSlide, "id"> = {
  type: "image",
  image_url: "",
  video_url: "",
  video_poster_url: "",
  headline: "",
  subline: "",
  cta: "Shop Now",
  cta_href: "/catalog",
  order: 0,
  is_active: true,
}

export default function HeroAdminPanel({ embedded = false }: { embedded?: boolean }) {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<HeroSlide | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    adminFetch<HeroSlide[]>("/admin/hero/")
      .then((d) => setSlides(Array.isArray(d) ? d.sort((a, b) => a.order - b.order) : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY, order: slides.length })
    setShowModal(true)
  }

  function openEdit(slide: HeroSlide) {
    setEditing(slide)
    setForm({
      type: slide.type,
      image_url: slide.image_url ?? "",
      video_url: slide.video_url ?? "",
      video_poster_url: slide.video_poster_url ?? "",
      headline: slide.headline,
      subline: slide.subline ?? "",
      cta: slide.cta ?? "",
      cta_href: slide.cta_href ?? "/catalog",
      order: slide.order,
      is_active: slide.is_active,
    })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const updated = await adminFetch<HeroSlide>(`/admin/hero/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(form),
        })
        setSlides((prev) => prev.map((s) => (s.id === editing.id ? updated : s)).sort((a, b) => a.order - b.order))
      } else {
        const created = await adminFetch<HeroSlide>("/admin/hero/", {
          method: "POST",
          body: JSON.stringify(form),
        })
        setSlides((prev) => [...prev, created].sort((a, b) => a.order - b.order))
      }
      setShowModal(false)
    } catch {
      alert("Failed to save slide.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteSlide(id: string) {
    if (!confirm("Delete this slide?")) return
    await adminFetch(`/admin/hero/${id}/`, { method: "DELETE" }).catch(() => {})
    setSlides((prev) => prev.filter((s) => s.id !== id))
  }

  async function toggleActive(slide: HeroSlide) {
    const updated = await adminFetch<HeroSlide>(`/admin/hero/${slide.id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !slide.is_active }),
    }).catch(() => null)
    if (updated) setSlides((prev) => prev.map((s) => (s.id === slide.id ? updated : s)))
  }

  async function moveSlide(slide: HeroSlide, dir: -1 | 1) {
    const idx = slides.findIndex((s) => s.id === slide.id)
    const swap = slides[idx + dir]
    if (!swap) return
    const newOrder = swap.order
    const oldOrder = slide.order
    await Promise.all([
      adminFetch(`/admin/hero/${slide.id}/`, { method: "PATCH", body: JSON.stringify({ order: newOrder }) }),
      adminFetch(`/admin/hero/${swap.id}/`, { method: "PATCH", body: JSON.stringify({ order: oldOrder }) }),
    ]).catch(() => {})
    load()
  }

  return (
    <div className={embedded ? "flex flex-col gap-4" : "p-4 sm:p-8 flex flex-col gap-6"}>
      <div className="flex items-start justify-between gap-4">
        {!embedded && (
          <div>
            <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Hero Slides</h1>
            <p className="text-[13px] text-dp-text-tertiary mt-1">Control the homepage carousel.</p>
          </div>
        )}
        {embedded && <p className="text-[13px] text-dp-text-tertiary">Homepage carousel slides.</p>}
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors shrink-0">
          <Plus size={14} /> Add Slide
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {slides.map((slide, i) => {
            const thumb = slide.type === "video" ? (slide.video_poster_url || slide.video_url) : slide.image_url
            return (
              <div key={slide.id} className="flex items-center gap-4 bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                <GripVertical size={16} className="text-dp-text-tertiary shrink-0" aria-hidden />
                <div className="relative w-28 h-16 rounded-sm overflow-hidden bg-dp-bg-elevated shrink-0">
                  {thumb ? <Image src={thumb} alt={slide.headline} fill className="object-cover" sizes="112px" /> : null}
                  {slide.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play size={16} className="text-white" />
                    </div>
                  )}
                  {slide.type === "image" && !thumb && <ImageIcon size={20} className="absolute inset-0 m-auto text-dp-text-tertiary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-lg text-dp-text-primary truncate">{slide.headline}</p>
                  <p className="text-[11px] text-dp-text-tertiary truncate">{slide.subline}</p>
                </div>
                <button type="button" onClick={() => toggleActive(slide)} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm ${slide.is_active ? "text-dp-success bg-dp-success/10 border-dp-success/30" : "text-dp-text-tertiary bg-dp-bg-elevated border-dp-border"}`}>
                  {slide.is_active ? "Active" : "Hidden"}
                </button>
                <span className="text-[11px] text-dp-text-tertiary">{i + 1}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveSlide(slide, -1)} disabled={i === 0} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary disabled:opacity-30" aria-label="Move up"><ChevronUp size={12} /></button>
                  <button type="button" onClick={() => moveSlide(slide, 1)} disabled={i === slides.length - 1} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary disabled:opacity-30" aria-label="Move down"><ChevronDown size={12} /></button>
                  <button type="button" onClick={() => openEdit(slide)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Edit"><Pencil size={12} /></button>
                  <button type="button" onClick={() => deleteSlide(slide.id)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors" aria-label="Delete"><Trash2 size={12} /></button>
                </div>
              </div>
            )
          })}
          {slides.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No hero slides yet.</p>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">{editing ? "Edit Slide" : "New Slide"}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-dp-text-tertiary hover:text-dp-text-primary"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Type</span>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "image" | "video" }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]">
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </label>
              {form.type === "image" ? (
                <AdminMediaUpload label="Image" previewUrl={form.image_url} folder="hero" onUploaded={(url) => setForm((f) => ({ ...f, image_url: url }))} />
              ) : (
                <>
                  <AdminMediaUpload label="Video" previewUrl={form.video_url} folder="hero" accept="video/*" onUploaded={(url) => setForm((f) => ({ ...f, video_url: url }))} />
                  <AdminMediaUpload label="Video Poster" previewUrl={form.video_poster_url} folder="hero" onUploaded={(url) => setForm((f) => ({ ...f, video_poster_url: url }))} />
                </>
              )}
              <input required value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder="Headline" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
              <textarea value={form.subline} onChange={(e) => setForm((f) => ({ ...f, subline: e.target.value }))} placeholder="Subline" rows={2} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.cta} onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))} placeholder="CTA label" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
                <input value={form.cta_href} onChange={(e) => setForm((f) => ({ ...f, cta_href: e.target.value }))} placeholder="CTA link" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
              </div>
              <label className="flex items-center gap-2 text-[13px] text-dp-text-secondary">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Active on homepage
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
