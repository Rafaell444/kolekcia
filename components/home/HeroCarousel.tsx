"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"

type HeroSlide = {
  id: string; type: string; image_url: string; video_url: string; video_poster_url: string
  headline: string; subline: string; cta: string; cta_href: string
}

const SLIDE_RATIO  = 0.84   // active slide = 84 % of container width
const GAP          = 10     // px between slides
const SWIPE_MIN_PX = 40     // minimum drag distance to commit slide change
const SWIPE_MIN_V  = 0.25   // px/ms — fast flick threshold

export default function HeroCarousel(): React.ReactElement {
  const [slides,     setSlides]     = useState<HeroSlide[]>([])
  const [current,    setCurrent]    = useState(0)
  const [paused,     setPaused]     = useState(false)
  const [cw,         setCw]         = useState(0)          // container px width
  const [dragX,      setDragX]      = useState(0)          // live drag offset in px
  const [dragging,   setDragging]   = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStart    = useRef({ x: 0, t: 0 })

  // ── Fetch ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    apiFetch<HeroSlide[]>("/cms/hero/")
      .then((d) => { if (!cancelled && d.length > 0) setSlides(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Measure container ─────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width))
    ro.observe(el)
    setCw(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // ── Navigate ──────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, Math.min(idx, slides.length - 1)))
    setDragX(0)
  }, [slides.length])

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  // ── Auto-advance ──────────────────────────────────────────
  useEffect(() => {
    if (paused || slides.length === 0) return
    const id = setInterval(next, 5000)
    return () => clearInterval(id)
  }, [next, paused, slides.length])

  // ── Track position (pure math, no ref tricks) ─────────────
  //
  //  Slides are laid out in a flex row:  [0] [GAP] [1] [GAP] [2] ...
  //  To centre slide N inside the container:
  //    offset = (cw - slideWidth) / 2  −  N × (slideWidth + GAP)
  //
  //  Increasing N  →  offset becomes more negative  →  track shifts LEFT
  //  Shifting LEFT  →  current slide exits left, next slide enters from right  ✓
  //
  const sw          = cw * SLIDE_RATIO
  const baseOffset  = cw > 0 ? (cw - sw) / 2 - current * (sw + GAP) : 0
  const trackX      = baseOffset + dragX

  // ── Drag / swipe ──────────────────────────────────────────
  function startDrag(clientX: number) {
    dragStart.current = { x: clientX, t: Date.now() }
    setDragging(true)
    setDragX(0)
    setPaused(true)
  }

  function moveDrag(clientX: number) {
    if (!dragging) return
    setDragX(clientX - dragStart.current.x)
  }

  function endDrag() {
    if (!dragging) return
    const dx  = dragX
    const vel = Math.abs(dx) / Math.max(Date.now() - dragStart.current.t, 1)

    setDragging(false)
    setDragX(0)
    setPaused(false)

    if (Math.abs(dx) > SWIPE_MIN_PX || vel > SWIPE_MIN_V) {
      // swipe LEFT (dx < 0) → show next;  swipe RIGHT (dx > 0) → show prev
      if (dx < 0) goTo(current + 1)
      else        goTo(current - 1)
    }
    // else: short drag — snap back (dragX already reset to 0)
  }

  // Touch
  const onTouchStart = (e: React.TouchEvent) => startDrag(e.touches[0].clientX)
  const onTouchMove  = (e: React.TouchEvent) => { e.preventDefault(); moveDrag(e.touches[0].clientX) }
  const onTouchEnd   = () => endDrag()

  // Mouse (desktop drag)
  const onMouseDown  = (e: React.MouseEvent) => { e.preventDefault(); startDrag(e.clientX) }
  const onMouseMove  = (e: React.MouseEvent) => moveDrag(e.clientX)
  const onMouseUp    = () => endDrag()

  const loading = slides.length === 0

  return (
    <section
      className="pt-3 sm:pt-4 px-3 sm:px-4 select-none"
      aria-label="Featured collections carousel"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { endDrag(); setPaused(false) }}
      onMouseEnter={() => setPaused(true)}
    >
      {/* ── Clip wrapper — always rendered so ResizeObserver can measure it ── */}
      <div
        ref={containerRef}
        className="overflow-hidden w-full rounded-2xl"
        style={{ touchAction: "pan-y" }}
        onMouseDown={loading ? undefined : onMouseDown}
        onTouchStart={loading ? undefined : onTouchStart}
        onTouchMove={loading ? undefined : onTouchMove}
        onTouchEnd={loading ? undefined : onTouchEnd}
      >
        {/* ── Skeleton ── */}
        {loading && (
          <div className="w-full aspect-[4/3] sm:aspect-[16/9] lg:aspect-[16/7] bg-dp-bg-elevated animate-pulse rounded-2xl" />
        )}

        {/* ── Sliding track ── */}
        {!loading && (
        <div
          className="cursor-grab active:cursor-grabbing"
          style={{
            display:    "flex",
            gap:        `${GAP}px`,
            transform:  `translateX(${trackX}px)`,
            transition: dragging ? "none" : "transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            willChange: "transform",
          }}
        >
          {slides.map((s, i) => {
            const isVideo = s.type === "video" && s.video_url
            const src = isVideo ? (s.video_poster_url || s.video_url) : s.image_url
            const active = i === current

            return (
              <div
                key={s.id}
                aria-hidden={!active}
                style={{
                  flexShrink: 0,
                  width:      sw > 0 ? `${sw}px` : `${SLIDE_RATIO * 100}%`,
                  borderRadius: "1rem",
                  overflow: "hidden",
                  position: "relative",
                  opacity:   active ? 1 : 0.45,
                  transform: active ? "scale(1)" : "scale(0.97)",
                  transition: "opacity 0.38s ease, transform 0.42s ease",
                }}
              >
                {/* Aspect-ratio box */}
                <div
                  style={{ position: "relative", background: "var(--dp-bg-elevated)" }}
                  className="aspect-[4/3] sm:aspect-[16/9] lg:aspect-[16/7]"
                >
                  {isVideo && s.video_url ? (
                    <video
                      src={s.video_url}
                      poster={s.video_poster_url || undefined}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : src ? (
                    <Image
                      src={src}
                      alt={s.headline}
                      fill
                      priority={i === 0}
                      className="object-cover"
                      draggable={false}
                      sizes="90vw"
                    />
                  ) : null}

                  {/* Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />

                  {/* Text content — only on the active slide */}
                  {active && (
                    <div
                      className="absolute inset-0 flex flex-col justify-end p-4 sm:p-7 md:p-10 pointer-events-none"
                      key={current}
                      style={{ animation: "hcFadeUp 0.4s ease both" }}
                    >
                      <p className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.22em] text-white/55 mb-2">
                        Featured Collection
                      </p>
                      <h1
                        className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-none mb-2 sm:mb-3"
                        style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)", pointerEvents: "auto" }}
                      >
                        {s.headline}
                      </h1>
                      <p className="hidden sm:block text-[13px] text-white/75 mb-4 max-w-md leading-relaxed">
                        {s.subline}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap" style={{ pointerEvents: "auto" }}>
                        <Link
                          href={s.cta_href || "/catalog"}
                          className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] sm:text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors"
                          draggable={false}
                          onClick={(e) => { if (Math.abs(dragX) > 5) e.preventDefault() }}
                        >
                          {s.cta || "Shop Now"}
                        </Link>
                        <Link
                          href="/catalog"
                          className="hidden sm:inline-flex items-center px-6 py-3 border border-white/30 hover:border-white/60 text-white text-[13px] font-semibold uppercase tracking-widest rounded-sm transition-colors backdrop-blur-sm"
                          draggable={false}
                        >
                          Browse All
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>

      {/* ── Controls: ‹ dots › ── */}
      <div className="flex items-center justify-center gap-3 mt-3">
        {loading ? (
          /* skeleton dots */
          <div className="flex items-center gap-1.5">
            {[0,1,2].map((i) => (
              <div key={i} className={`h-1.5 rounded-full bg-dp-bg-elevated animate-pulse ${i===0?"w-5":"w-1.5"}`} />
            ))}
          </div>
        ) : (
          <>
            <button
              onClick={prev}
              disabled={current === 0}
              aria-label="Previous slide"
              className="w-7 h-7 flex items-center justify-center rounded-full border border-dp-border bg-dp-bg-elevated text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1.5" role="tablist" aria-label="Carousel slides">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={i === current}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === current
                      ? "w-5 h-1.5 bg-dp-accent-cta"
                      : "w-1.5 h-1.5 bg-dp-text-tertiary hover:bg-dp-text-secondary"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              disabled={current === slides.length - 1}
              aria-label="Next slide"
              className="w-7 h-7 flex items-center justify-center rounded-full border border-dp-border bg-dp-bg-elevated text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes hcFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
