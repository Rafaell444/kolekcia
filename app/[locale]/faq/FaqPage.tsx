"use client"

import React, { useEffect, useState } from "react"
import SiteShell from "@/components/layout/SiteShell"
import LocalizedLink from "@/components/seo/LocalizedLink"
import { ChevronDown, ChevronUp } from "lucide-react"
import { apiFetch } from "@/lib/api"

type Faq = { id: number; question: string; answer: string; category: string; order: number }

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-dp-border rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left bg-dp-bg-surface hover:bg-dp-bg-elevated transition-colors"
        aria-expanded={open}
      >
        <span className="text-[14px] font-semibold text-dp-text-primary pr-4">{q}</span>
        {open ? <ChevronUp size={16} className="text-dp-text-tertiary shrink-0" /> : <ChevronDown size={16} className="text-dp-text-tertiary shrink-0" />}
      </button>
      {open && (
        <div className="px-5 py-4 border-t border-dp-border bg-dp-bg-elevated">
          <p className="text-[13px] text-dp-text-secondary leading-relaxed whitespace-pre-line">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function FaqPage({
  initialFaqs = [],
}: {
  initialFaqs?: Faq[]
}): React.ReactElement {
  const [faqs, setFaqs] = useState<Faq[]>(initialFaqs)
  const [loading, setLoading] = useState(initialFaqs.length === 0)

  useEffect(() => {
    if (initialFaqs.length > 0) return
    let cancelled = false
    apiFetch<Faq[]>("/cms/faqs/")
      .then((d) => { if (!cancelled) setFaqs(Array.isArray(d) ? d : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [initialFaqs.length])

  return (
    <SiteShell>
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-12">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">Support</p>
          <h1 className="font-display text-5xl md:text-6xl text-dp-text-primary">Frequently Asked Questions</h1>
          <p className="text-[14px] text-dp-text-secondary mt-3 max-w-2xl">Answers to common questions about orders, shipping, returns, and our metal products.</p>
        </div>
      </div>

      <div className="dp-container py-12 max-w-3xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : faqs.length === 0 ? (
          <p className="text-dp-text-tertiary text-[14px]">No FAQs published yet. Check back soon or <LocalizedLink href="/contact" className="text-dp-accent-cta hover:underline">contact us</LocalizedLink>.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {faqs.map((faq) => <FaqItem key={faq.id} q={faq.question} a={faq.answer} />)}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
