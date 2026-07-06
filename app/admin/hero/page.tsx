"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { Play, ImageIcon, GripVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type HeroSlide = {
  id: string; type: "image" | "video"; image_url: string; video_poster_url: string
  headline: string; subline: string; cta: string; order: number; is_active: boolean
}

export default function AdminHeroPage(): React.ReactElement {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminFetch<HeroSlide[]>("/admin/hero/")
      .then((d) => { if (!cancelled) setSlides(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function deleteSlide(id: string) {
    await adminFetch(`/admin/hero/${id}/`, { method: "DELETE" }).catch(() => {})
    setSlides((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Hero Slides</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Control the homepage carousel. Each slide supports an image or a video background.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors shrink-0">
          <Plus size={14} /> Add Slide
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {slides.map((slide, i) => {
            const thumb = slide.type === "video" ? slide.video_poster_url : slide.image_url
            return (
              <div key={slide.id} className="flex items-center gap-4 bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                <GripVertical size={16} className="text-dp-text-tertiary shrink-0 cursor-grab" aria-hidden />
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
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm ${slide.is_active ? "text-dp-success bg-dp-success/10 border-dp-success/30" : "text-dp-text-tertiary bg-dp-bg-elevated border-dp-border"}`}>
                  {slide.is_active ? "Active" : "Hidden"}
                </span>
                <span className="text-[11px] text-dp-text-tertiary">{i + 1}</span>
                <div className="flex gap-1">
                  <button className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Edit"><Pencil size={12} /></button>
                  <button onClick={() => deleteSlide(slide.id)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors" aria-label="Delete"><Trash2 size={12} /></button>
                </div>
              </div>
            )
          })}
          {slides.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No hero slides yet.</p>}
        </div>
      )}
    </div>
  )
}
