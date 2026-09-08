"use client"

// Infinite carousel — virtual offset so drag works both directions without hitting scroll edges
import React, { useCallback, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { apiFetch } from "@/lib/api"

const BRANDS = [
  { id: "b1",  name: "The Witcher",       bg: "#000",   text: "#fff", abbr: "THE WITCHER" },
  { id: "b2",  name: "Harry Potter",      bg: "#f5f0e8",text: "#1a1a1a", abbr: "Harry Potter" },
  { id: "b3",  name: "Halo",              bg: "#1a3a2a",text: "#4caf7d", abbr: "HALO" },
  { id: "b4",  name: "Chainsaw Man",      bg: "#c00",   text: "#fff", abbr: "CHAINSAW MAN" },
  { id: "b5",  name: "Stranger Things",   bg: "#111",   text: "#e40404", abbr: "STRANGER THINGS" },
  { id: "b6",  name: "Naruto",            bg: "#f60",   text: "#fff", abbr: "NARUTO" },
  { id: "b7",  name: "Call of Duty",      bg: "#000",   text: "#c8a84b", abbr: "CALL OF DUTY" },
  { id: "b8",  name: "Dark Souls",        bg: "#1a1408",text: "#c8a84b", abbr: "DARK SOULS" },
  { id: "b9",  name: "Game of Thrones",   bg: "#0d0d0d",text: "#c8a84b", abbr: "GAME OF THRONES" },
  { id: "b10", name: "League of Legends", bg: "#0bc4e3",text: "#c8aa6e", abbr: "LoL" },
  { id: "b11", name: "Dungeons & Dragons",bg: "#8b0000",text: "#fff", abbr: "D&D" },
  { id: "b12", name: "One Piece",         bg: "#e30000",text: "#fff", abbr: "ONE PIECE" },
  { id: "b13", name: "Demon Slayer",      bg: "#1a0a00",text: "#e86d1f", abbr: "DEMON SLAYER" },
  { id: "b14", name: "Godzilla",          bg: "#0a2a0a",text: "#4caf7d", abbr: "GODZILLA" },
  { id: "b15", name: "Helldivers",        bg: "#1a1a00",text: "#e8d44d", abbr: "HELLDIVERS 2" },
  { id: "b16", name: "DC",               bg: "#0074e8",text: "#fff", abbr: "DC" },
]

const COPIES = 3

function segmentWidth(el: HTMLDivElement) {
  return el.scrollWidth / COPIES
}

/** Map unbounded offset → scroll position inside the middle copy */
function applyOffset(el: HTMLDivElement, offset: number) {
  const seg = segmentWidth(el)
  if (seg <= 0) return
  const local = ((offset % seg) + seg) % seg
  el.scrollLeft = seg + local
}

export default function BrandsCarousel() {
  const params = useParams<{ locale?: string }>()
  const locale = params?.locale === "ka" || params?.locale === "ru" ? params.locale : "en"
  const [brands, setBrands] = React.useState(BRANDS)
  const trackRef = useRef<HTMLDivElement>(null)
  const mobileTrackOneRef = useRef<HTMLDivElement>(null)
  const mobileTrackTwoRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const dragStartRef = useRef({ x: 0, offset: 0 })
  const rafRef = useRef<number | null>(null)

  const paint = useCallback(() => {
    if (trackRef.current) applyOffset(trackRef.current, offsetRef.current)
    if (mobileTrackOneRef.current) applyOffset(mobileTrackOneRef.current, offsetRef.current)
    if (mobileTrackTwoRef.current) {
      applyOffset(mobileTrackTwoRef.current, offsetRef.current + segmentWidth(mobileTrackTwoRef.current) / 2)
    }
  }, [])

  const tick = useCallback(() => {
    if (draggingRef.current) return
    offsetRef.current += 0.6
    paint()
  }, [paint])

  useEffect(() => {
    apiFetch<Array<{ id: number; name: string; abbreviation: string; background: string; text_color: string }>>("/cms/fandoms/").then((data) => {
      if (Array.isArray(data) && data.length) setBrands(data.map((b) => ({ id: String(b.id), name: b.name, bg: b.background, text: b.text_color, abbr: b.abbreviation })))
    }).catch(() => {})
    const tracks = [trackRef.current, mobileTrackOneRef.current, mobileTrackTwoRef.current].filter(Boolean) as HTMLDivElement[]
    if (tracks.length === 0) return

    paint()
    const ro = new ResizeObserver(paint)
    tracks.forEach((track) => ro.observe(track))

    const loop = () => {
      tick()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      ro.disconnect()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [tick, paint])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget
    e.preventDefault()
    draggingRef.current = true
    pointerIdRef.current = e.pointerId
    dragStartRef.current = { x: e.clientX, offset: offsetRef.current }
    el.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return
    const dx = e.clientX - dragStartRef.current.x
    offsetRef.current = dragStartRef.current.offset - dx
    paint()
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    pointerIdRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const mobileRows = [
    brands.filter((_, index) => index % 2 === 0),
    brands.filter((_, index) => index % 2 === 1),
  ]

  function brandCards(items: typeof brands) {
    return [...items, ...items, ...items].map((brand, i) => (
      <div
        key={`${brand.id}-${i}`}
        className="flex h-[72px] w-[110px] shrink-0 items-center justify-center rounded-lg"
        style={{ background: brand.bg }}
        title={brand.name}
      >
        <span
          className="pointer-events-none px-2 text-center text-[11px] font-black leading-tight tracking-tight"
          style={{ color: brand.text }}
        >
          {brand.abbr}
        </span>
      </div>
    ))
  }

  return (
    <section className="overflow-hidden border-y border-dp-border bg-background py-10" aria-label="Official licensed fandoms">
      <p className="mx-auto mb-6 max-w-[24rem] px-5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-dp-text-tertiary">
        {{
          en: "Official Metal Posters from 200+ Fandoms",
          ka: "ოფიციალური მეტალის პოსტერები 200-ზე მეტი ფანდომიდან",
          ru: "Официальные металлические постеры из более чем 200 фандомов",
        }[locale]}
      </p>
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-background to-transparent" aria-hidden />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-background to-transparent" aria-hidden />

        <div
          ref={trackRef}
          className="hidden gap-3 overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing select-none touch-none sm:flex"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-hidden
        >
          {brandCards(brands)}
        </div>

        <div className="flex flex-col gap-5 sm:hidden" aria-hidden>
          {mobileRows.map((row, index) => (
            <div
              key={index}
              ref={index === 0 ? mobileTrackOneRef : mobileTrackTwoRef}
              className="flex cursor-grab gap-5 overflow-hidden select-none touch-pan-y active:cursor-grabbing"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {brandCards(row)}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
