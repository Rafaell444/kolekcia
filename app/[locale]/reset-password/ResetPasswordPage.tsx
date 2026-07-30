"use client"

import React, { Suspense, useEffect, useState } from "react"
import LocalizedLink from "@/components/seo/LocalizedLink"
import SiteShell from "@/components/layout/SiteShell"
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { getPasswordRules, validatePassword } from "@/lib/password"

function InvalidLinkCard({ message }: { message: string }): React.ReactElement {
  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 text-center flex flex-col items-center gap-4">
      <h2 className="font-display text-2xl text-dp-text-primary">Link unavailable</h2>
      <p className="text-[13px] text-dp-text-secondary">{message}</p>
      <LocalizedLink href="/forgot-password" className="text-[13px] font-bold text-dp-accent-cta hover:text-dp-accent-cta-hover">
        Request a new reset link
      </LocalizedLink>
      <LocalizedLink href="/login" className="flex items-center justify-center gap-1 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
        <ArrowLeft size={12} /> Back to login
      </LocalizedLink>
    </div>
  )
}

function ResetPasswordForm(): React.ReactElement {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(Boolean(token))
  const [tokenValid, setTokenValid] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const rules = getPasswordRules(password)

  useEffect(() => {
    if (!token) {
      setChecking(false)
      setTokenValid(false)
      return
    }

    let cancelled = false
    setChecking(true)
    apiFetch<{ valid: boolean }>(`/auth/reset-password/?token=${encodeURIComponent(token)}`)
      .then(() => {
        if (!cancelled) setTokenValid(true)
      })
      .catch(() => {
        if (!cancelled) setTokenValid(false)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!token) {
      setError("This reset link is missing a token. Request a new one.")
      return
    }
    if (!password || !password2) {
      setError("Please fill in both password fields.")
      return
    }
    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== password2) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      await apiFetch("/auth/reset-password/", {
        method: "POST",
        body: JSON.stringify({ token, password, password2 }),
      })
      setDone(true)
      setTokenValid(false)
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string; password?: string[]; password2?: string[] } }
      const data = apiErr?.data
      const message =
        data?.detail
        || data?.password?.[0]
        || data?.password2?.[0]
        || "Invalid or expired link. Please request a new reset email."
      setError(message)
      if (data?.detail === "Invalid or expired token.") {
        setTokenValid(false)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <InvalidLinkCard message="This password reset link is incomplete. Request a new one from the forgot password page." />
    )
  }

  if (checking) {
    return (
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 text-center text-[13px] text-dp-text-tertiary">
        Checking reset link…
      </div>
    )
  }

  if (done) {
    return (
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 text-center flex flex-col items-center gap-4">
        <CheckCircle size={40} className="text-dp-success" />
        <h2 className="font-display text-2xl text-dp-text-primary">Password updated</h2>
        <p className="text-[13px] text-dp-text-secondary">
          Your password has been reset. You can sign in with your new password.
        </p>
        <LocalizedLink href="/login" className="text-[13px] font-bold text-dp-accent-cta hover:text-dp-accent-cta-hover">
          Back to login
        </LocalizedLink>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <InvalidLinkCard message="This reset link has already been used or has expired. Request a new one if you still need to change your password." />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 flex flex-col gap-5">
      {error && (
        <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[12px] text-dp-accent-cta font-semibold">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">
          New password
        </label>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
          <input
            id="password"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-9 pr-10 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary hover:text-dp-text-primary"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {password.length > 0 && (
        <ul className="flex flex-col gap-1 -mt-2">
          {rules.map((rule) => (
            <li
              key={rule.key}
              className={`text-[11px] flex items-center gap-1.5 ${rule.ok ? "text-dp-success" : "text-dp-text-tertiary"}`}
            >
              <CheckCircle size={12} className={rule.ok ? "opacity-100" : "opacity-30"} aria-hidden />
              {rule.label}
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="password2" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">
          Confirm password
        </label>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
          <input
            id="password2"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full pl-9 pr-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving…
          </span>
        ) : "Set new password"}
      </button>

      <LocalizedLink href="/login" className="flex items-center justify-center gap-1 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
        <ArrowLeft size={12} /> Back to login
      </LocalizedLink>
    </form>
  )
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <SiteShell>
      <div className="dp-container py-16 flex items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-4xl text-dp-text-primary tracking-wider mb-2">Set New Password</h1>
            <p className="text-[13px] text-dp-text-tertiary">Choose a new password for your Koleqcia account.</p>
          </div>
          <Suspense fallback={<div className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 text-center text-[13px] text-dp-text-tertiary">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </SiteShell>
  )
}
