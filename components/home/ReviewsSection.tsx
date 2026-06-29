"use client"

import { useState } from "react"
import { Star } from "lucide-react"

// Reviews sourced from admin panel (mock) + Google-style reviews
const CUSTOMER_REVIEWS = [
  {
    id: "cr1",
    name: "James P.",
    avatar: "JP",
    rating: 5,
    date: "June 2024",
    text: "Absolutely stunning. The metallic finish makes colors pop so much more than any paper print I've owned. Mounting was effortless.",
    source: "google",
    verified: true,
  },
  {
    id: "cr2",
    name: "Mia H.",
    avatar: "MH",
    rating: 5,
    date: "May 2024",
    text: "My partner couldn't believe this was a metal poster — it looks like a painting. Fast shipping, gorgeous packaging.",
    source: "google",
    verified: true,
  },
  {
    id: "cr3",
    name: "Tom F.",
    avatar: "TF",
    rating: 5,
    date: "June 2024",
    text: "Perfect gift. The limited edition dragon piece sold out right after I ordered — glad I didn't wait!",
    source: "admin",
    verified: true,
  },
  {
    id: "cr4",
    name: "Sofia R.",
    avatar: "SR",
    rating: 4,
    date: "April 2024",
    text: "Great quality, fast delivery. One corner had a tiny dent but customer support replaced it same day. 10/10 service.",
    source: "google",
    verified: true,
  },
  {
    id: "cr5",
    name: "Luca B.",
    avatar: "LB",
    rating: 5,
    date: "March 2024",
    text: "I've ordered 6 pieces now. The magnet mounting system is genius — I rearrange my wall every month.",
    source: "admin",
    verified: true,
  },
  {
    id: "cr6",
    name: "Yuki T.",
    avatar: "YT",
    rating: 5,
    date: "June 2024",
    text: "The anime selection here is unbeatable. Museum quality on every print. My gaming room looks incredible.",
    source: "google",
    verified: true,
  },
]

const SOCIAL_LINKS = [
  { name: "Reddit",    href: "#", bg: "#FF4500", textColor: "#fff", abbr: "r/" },
  { name: "Discord",   href: "#", bg: "#5865F2", textColor: "#fff", abbr: "dis" },
  { name: "Pinterest", href: "#", bg: "#E60023", textColor: "#fff", abbr: "P" },
  { name: "Facebook",  href: "#", bg: "#1877F2", textColor: "#fff", abbr: "f" },
  { name: "X",         href: "#", bg: "#000",    textColor: "#fff", abbr: "X" },
  { name: "TikTok",    href: "#", bg: "#010101", textColor: "#fff", abbr: "TT" },
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

export default function ReviewsSection() {
  const [tab, setTab] = useState<"all" | "google" | "admin">("all")

  const shown = CUSTOMER_REVIEWS.filter((r) => tab === "all" || r.source === tab)

  return (
    <section className="py-16 bg-dp-bg-elevated border-y border-dp-border" aria-labelledby="reviews-heading">
      <div className="dp-container">
        {/* Heading */}
        <h2
          className="font-display text-4xl md:text-5xl font-black uppercase text-center text-dp-text-primary mb-4"
          id="reviews-heading"
        >
          See Why Other People Love<br className="hidden sm:block" /> Our Metal Posters
        </h2>

        {/* Trustpilot summary */}
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
            Excellent&nbsp;|&nbsp;Based on 18,120 reviewers
          </p>
        </div>

        {/* Source filter tabs */}
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

        {/* Review cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {shown.map((r) => (
            <article
              key={r.id}
              className="bg-dp-bg-surface border border-dp-border rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-dp-accent-cta flex items-center justify-center text-white text-[12px] font-black shrink-0">
                    {r.avatar}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-dp-text-primary leading-tight">{r.name}</p>
                    <p className="text-[11px] text-dp-text-tertiary">{r.date}</p>
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

        {/* Join community */}
        <div className="text-center">
          <p className="text-[13px] font-bold text-dp-text-secondary mb-4 uppercase tracking-widest">
            Join our Community on
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dp-border hover:border-dp-border-hover hover:shadow-md transition-all"
                aria-label={`Join on ${s.name}`}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                  style={{ background: s.bg, color: s.textColor }}
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
