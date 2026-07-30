"use client"

import React, { useState } from "react"
import LocalizedLink from "@/components/seo/LocalizedLink"
import SiteShell from "@/components/layout/SiteShell"
import { Mail, ArrowLeft, CheckCircle } from "lucide-react"
import { apiFetch } from "@/lib/api"

type ForgotPasswordResponse = {
  detail: string
  remaining?: number
  limit?: number
}

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [remaining, setRemaining] = useState<number | null>(null)
  const [limit, setLimit] = useState(5)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!email) { setError("Email is required."); return }
    setLoading(true)
    try {
      const data = await apiFetch<ForgotPasswordResponse>("/auth/forgot-password/", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      if (typeof data.limit === "number") setLimit(data.limit)
      if (typeof data.remaining === "number") setRemaining(data.remaining)
      setSent(true)
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: ForgotPasswordResponse }
      if (typeof apiErr?.data?.limit === "number") setLimit(apiErr.data.limit)
      if (typeof apiErr?.data?.remaining === "number") setRemaining(apiErr.data.remaining)
      if (apiErr?.status === 429) {
        setError(apiErr.data?.detail || "Too many reset requests. Try again later.")
      } else {
        setError("Something went wrong. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const attemptsLeftLabel =
    remaining === null
      ? `Up to ${limit} reset emails per hour for this address.`
      : `${remaining} of ${limit} reset emails remaining this hour.`

  return (
    <SiteShell>
      <div className="dp-container py-16 flex items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-4xl text-dp-text-primary tracking-wider mb-2">Reset Password</h1>
            <p className="text-[13px] text-dp-text-tertiary">{"Enter your email and we'll send you a reset link."}</p>
          </div>

          {sent ? (
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 text-center flex flex-col items-center gap-4">
              <CheckCircle size={40} className="text-dp-success" />
              <h2 className="font-display text-2xl text-dp-text-primary">Check your email</h2>
              <p className="text-[13px] text-dp-text-secondary">
                If <strong>{email}</strong> is registered, you will receive a password reset link shortly.
              </p>
              <p className="text-[12px] text-dp-text-tertiary">{attemptsLeftLabel}</p>
              <LocalizedLink href="/login" className="text-[13px] font-bold text-dp-accent-cta hover:text-dp-accent-cta-hover">
                Back to login
              </LocalizedLink>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 flex flex-col gap-5">
              {error && (
                <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[12px] text-dp-accent-cta font-semibold">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                  />
                </div>
              </div>

              <p className="text-[11px] text-dp-text-tertiary -mt-2">{attemptsLeftLabel}</p>

              <button
                type="submit"
                disabled={loading || remaining === 0}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : "Send Reset Link"}
              </button>

              <LocalizedLink href="/login" className="flex items-center justify-center gap-1 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
                <ArrowLeft size={12} /> Back to login
              </LocalizedLink>
            </form>
          )}
        </div>
      </div>
    </SiteShell>
  )
}
