"use client"

import React, { useState } from "react"
import Image from "next/image"
import LocalizedLink from "@/components/seo/LocalizedLink"
import { apiFetch } from "@/lib/api"

export default function NewsletterSection({ content }: { content?: { heading?: string; subheading?: string; promoText?: string; imageUrl?: string } }): React.ReactElement {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError("")
    try {
      await apiFetch("/newsletter/subscribe/", { method: "POST", body: JSON.stringify({ email }) })
      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-4 bg-dp-bg-elevated" aria-labelledby="newsletter-heading">
      <div className="dp-container">
        <div className="rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 min-h-[360px] bg-[#dce8f7]">
          <div className="relative min-h-[240px] md:min-h-0">
            <Image
              src={content?.imageUrl ?? "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&h=600&fit=crop"}
              alt="Sign up and save on your first order"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-blue-600/10" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <p className="font-display text-6xl sm:text-7xl font-black text-white uppercase leading-none drop-shadow-xl text-center whitespace-pre-line">
                {content?.promoText ?? "Sign Up &\nSave\n25%!"}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center px-8 py-10 bg-[#dce8f7]">
            {submitted ? (
              <div className="text-center">
                <p className="font-display text-3xl font-black text-dp-text-primary mb-2">You&apos;re in!</p>
                <p className="text-dp-text-secondary text-sm">Check your inbox for your 25% off code. You earned +25 XP!</p>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl md:text-3xl font-black text-dp-text-primary mb-2" id="newsletter-heading">
                  {content?.heading ?? "Sign up and never miss a deal"}
                </h2>
                <p className="text-[13px] text-dp-text-secondary mb-5">
                  {content?.subheading ?? "Join our newsletter for the latest discounts and Koleqcia goodies"}
                </p>
                {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <label htmlFor="newsletter-email" className="sr-only">Email address</label>
                  <input
                    id="newsletter-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your e-mail"
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-sm bg-white border border-dp-border text-dp-text-primary text-[13px] placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-accent-cta"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors shrink-0"
                  >
                    {loading ? "…" : "Sign Up"}
                  </button>
                </form>
                <p className="text-[10px] text-dp-text-tertiary leading-relaxed mt-3">
                  By clicking &quot;Sign up&quot;, you agree to receiving emails and to processing of your personal data in accordance with the{" "}
                  <LocalizedLink href="/privacy" className="underline hover:text-dp-text-primary">Privacy policy</LocalizedLink>.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
