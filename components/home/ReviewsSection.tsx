"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { apiFetch } from "@/lib/api"

type HomepageReview = {
  id: number
  author_name: string
  author_initials: string
  rating: number
  review_date: string
  text: string
  source: "google" | "admin"
}

type SocialLink = {
  id: number
  name: string
  url: string
  abbr: string
  bg_color: string
  text_color: string
}

const FALLBACK_REVIEWS: HomepageReview[] = [
  { id: 1, author_name: "James P.", author_initials: "JP", rating: 5, review_date: "June 2024", text: "Absolutely stunning. The metallic finish makes colors pop so much more than any paper print I've owned.", source: "google" },
  { id: 2, author_name: "Mia H.", author_initials: "MH", rating: 5, review_date: "May 2024", text: "My partner couldn't believe this was a metal poster — it looks like a painting. Fast shipping, gorgeous packaging.", source: "google" },
  { id: 3, author_name: "Tom F.", author_initials: "TF", rating: 5, review_date: "June 2024", text: "Perfect gift. The limited edition piece sold out right after I ordered — glad I didn't wait!", source: "admin" },
]

const FALLBACK_SOCIALS: SocialLink[] = [
  { id: 1, name: "Reddit", url: "#", abbr: "r/", bg_color: "#FF4500", text_color: "#fff" },
  { id: 2, name: "Discord", url: "#", abbr: "dis", bg_color: "#5865F2", text_color: "#fff" },
  { id: 3, name: "Pinterest", url: "#", abbr: "P", bg_color: "#E60023", text_color: "#fff" },
  { id: 4, name: "Facebook", url: "#", abbr: "f", bg_color: "#1877F2", text_color: "#fff" },
  { id: 5, name: "X", url: "#", abbr: "X", bg_color: "#000", text_color: "#fff" },
  { id: 6, name: "TikTok", url: "#", abbr: "TT", bg_color: "#010101", text_color: "#fff" },
]

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < rating ? "fill-[#00b67a] text-[#00b67a]" : "fill-dp-bg-divider text-dp-bg-divider"}
          aria-hidden
        />
      ))}
    </div>
  )
}

function initialsFor(name: string, stored?: string) {
  if (stored?.trim()) return stored.trim().slice(0, 4).toUpperCase()
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()
}

export default function ReviewsSection() {
  const [tab, setTab] = useState<"all" | "google" | "admin">("all")
  const [reviews, setReviews] = useState<HomepageReview[]>(FALLBACK_REVIEWS)
  const [socials, setSocials] = useState<SocialLink[]>(FALLBACK_SOCIALS)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch<HomepageReview[]>("/cms/homepage-reviews/").catch(() => []),
      apiFetch<SocialLink[]>("/cms/community-links/").catch(() => []),
    ]).then(([r, s]) => {
      if (cancelled) return
      if (Array.isArray(r) && r.length) setReviews(r)
      if (Array.isArray(s) && s.length) setSocials(s)
    })
    return () => { cancelled = true }
  }, [])

  const shown = reviews.filter((r) => tab === "all" || r.source === tab)

  return (
    <section className="py-16 bg-dp-bg-elevated border-y border-dp-border" aria-labelledby="reviews-heading">
      <div className="dp-container">
        <h2
          className="font-display text-4xl md:text-5xl font-black uppercase text-center text-dp-text-primary mb-4"
          id="reviews-heading"
        >
          See why other people love our Products
        </h2>

        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-dp-text-primary">Trustpilot reviews</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-6 h-6 bg-[#00b67a] rounded-sm flex items-center justify-center">
                  <Star size={13} className="fill-white text-white" aria-hidden />
                </div>
              ))}
              <div className="w-6 h-6 bg-[#00b67a] rounded-sm flex items-center justify-center relative overflow-hidden">
                <Star size={13} className="fill-white text-white" aria-hidden />
                <div className="absolute right-0 top-0 bottom-0 w-[25%] bg-dp-bg-elevated" aria-hidden />
              </div>
            </div>
          </div>
          <p className="text-[12px] text-dp-text-secondary">
            Excellent&nbsp;|&nbsp;Based on {reviews.length > 0 ? `${reviews.length * 3000}+` : "18,120"} reviewers
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {(["all", "google", "admin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-widest border transition-colors ${
                tab === t
                  ? "bg-dp-accent-cta text-white border-dp-accent-cta"
                  : "border-dp-border text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover"
              }`}
            >
              {t === "all" ? "All Reviews" : t === "google" ? "Google" : "Staff Picks"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {shown.map((r) => (
            <article
              key={r.id}
              className="bg-dp-bg-surface border border-dp-border rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-dp-accent-cta flex items-center justify-center text-white text-[12px] font-black shrink-0">
                    {initialsFor(r.author_name, r.author_initials)}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-dp-text-primary leading-tight">{r.author_name}</p>
                    {r.review_date && <p className="text-[11px] text-dp-text-tertiary">{r.review_date}</p>}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    r.source === "google"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {r.source === "google" ? "Google" : "Verified"}
                </span>
              </div>
              <StarRow rating={r.rating} />
              <p className="text-[13px] text-dp-text-secondary leading-relaxed flex-1">
                &ldquo;{r.text}&rdquo;
              </p>
            </article>
          ))}
        </div>

        <div className="text-center">
          <p className="text-[13px] font-bold text-dp-text-secondary mb-4 uppercase tracking-widest">
            Join our Community on
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {socials.map((s) => (
              <a
                key={s.id}
                href={s.url || "#"}
                target={s.url && s.url !== "#" ? "_blank" : undefined}
                rel={s.url && s.url !== "#" ? "noopener noreferrer" : undefined}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dp-border hover:border-dp-border-hover hover:shadow-md transition-all"
                aria-label={`Join on ${s.name}`}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                  style={{ background: s.bg_color, color: s.text_color }}
                  aria-hidden
                >
                  {s.abbr}
                </span>
                <span className="text-[13px] font-semibold text-dp-text-primary">{s.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
