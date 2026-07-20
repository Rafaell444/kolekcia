"use client"

import React, { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import GoogleAuthButton from "@/components/auth/GoogleAuthButton"
import { useCart } from "@/contexts/cart-context"
import { clearPendingCartIntent, getPendingCartIntent } from "@/lib/pending-cart"
import { claimPendingReferral } from "@/lib/referral"

function LoginPageInner(): React.ReactElement {
  const { login, loginWithGoogle } = useAuth()
  const { addItem } = useCart()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState("")

  async function finishAuthRedirect() {
    await claimPendingReferral()

    const pending = getPendingCartIntent()
    const next = searchParams.get("next")
    const returnTo = pending?.returnTo ?? next ?? "/account"

    if (pending) {
      try {
        if (pending.sizeVariantId) {
          await addItem(null, pending.quantity, { size_variant_id: pending.sizeVariantId })
        } else if (pending.variantId) {
          await addItem(pending.variantId, pending.quantity)
        }
      } catch {
        // still redirect back to product page
      } finally {
        clearPendingCartIntent()
      }
    }

    router.push(returnTo.startsWith("/") ? returnTo : "/account")
  }

  async function handleGoogleSuccess(idToken: string) {
    setError("")
    setGoogleLoading(true)
    try {
      await loginWithGoogle(idToken, rememberMe)
      await finishAuthRedirect()
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setError(apiErr?.data?.detail ?? "Google sign-in failed. Please try again.")
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!email || !password) { setError("Please fill in all fields."); return }
    setLoading(true)
    try {
      await login(email, password, rememberMe)
      await finishAuthRedirect()
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setError(apiErr?.data?.detail ?? "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SiteShell>
      <div className="dp-container py-16 flex items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-sm border border-dp-border-hover bg-dp-bg-elevated mb-4" aria-hidden>
              <span className="block w-6 h-6 rounded-sm border-2" style={{ borderColor: "var(--dp-accent-cta)" }} />
            </div>
            <h1 className="font-display text-4xl text-dp-text-primary tracking-wider mb-2">Welcome Back</h1>
            <p className="text-[13px] text-dp-text-tertiary">Sign in to your Kolekcia account</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 flex flex-col gap-5" noValidate>
            <GoogleAuthButton
              mode="signin"
              disabled={loading || googleLoading}
              onSuccess={handleGoogleSuccess}
              onError={(message) => setError(message)}
            />

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-dp-border" />
              <span className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">or</span>
              <div className="flex-1 border-t border-dp-border" />
            </div>

            {error && (
              <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[12px] text-dp-accent-cta font-semibold">
                {error}
              </div>
            )}

            {/* Email */}
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[11px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary hover:text-dp-text-primary transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-[var(--dp-accent-cta)]"
              />
              <span className="text-[12px] text-dp-text-secondary">Remember me</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <>Sign In <ArrowRight size={14} /></>
              )}
            </button>

            {/* Register link */}
            <p className="text-center text-[13px] text-dp-text-secondary">
              {"Don't have an account? "}
              <Link href="/register" className="font-bold text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors">
                Create one free
              </Link>
            </p>
          </form>

          {/* Perks */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: "🎨", label: "2.5M+ designs" },
              { icon: "⚡", label: "Earn XP & badges" },
              { icon: "🎁", label: "Exclusive drops" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 py-3 bg-dp-bg-surface border border-dp-border rounded-sm">
                <span aria-hidden>{icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-dp-text-tertiary text-center">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  )
}

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense fallback={
      <SiteShell>
        <div className="dp-container py-24 text-center text-dp-text-tertiary">Loading…</div>
      </SiteShell>
    }>
      <LoginPageInner />
    </Suspense>
  )
}
