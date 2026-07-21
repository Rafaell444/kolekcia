"use client"

import React, { Suspense, useState } from "react"
import LocalizedLink from "@/components/seo/LocalizedLink"
import { useRouter } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle2, Gift } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { storeTokens, storeUser } from "@/lib/auth-storage"
import { useAuth } from "@/contexts/auth-context"
import GoogleAuthButton from "@/components/auth/GoogleAuthButton"
import { captureReferralFromUrl, claimPendingReferral } from "@/lib/referral"
import { useLocalePrefix } from "@/lib/use-localized-href"

const PERKS = [
  "Free shipping on your first order",
  "Early access to Limited Edition drops",
  "Earn XP & unlock exclusive badges",
  "Save favourites to wishlists",
  "Track orders in real-time",
  "New member bonus",
]

export default function RegisterPage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  )
}

function RegisterPageInner(): React.ReactElement {
  const router = useRouter()
  const lp = useLocalePrefix()
  const { refreshUser, loginWithGoogle } = useAuth()
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errors, setErrors]     = useState<Record<string, string>>({})

  React.useEffect(() => {
    captureReferralFromUrl()
  }, [])

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim())          e.name     = "Name is required."
    if (!email.includes("@")) e.email    = "Enter a valid email."
    if (password.length < 8)   e.password = "Password must be at least 8 characters."
    if (password !== confirm)  e.confirm  = "Passwords do not match."
    return e
  }

  async function handleGoogleSuccess(idToken: string) {
    setErrors({})
    setGoogleLoading(true)
    try {
      await loginWithGoogle(idToken, false)
      await refreshUser()
      await claimPendingReferral()
      router.push(`${lp}/account`)
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setErrors({ detail: apiErr?.data?.detail ?? "Google sign-up failed. Please try again." })
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      type RegisterResponse = { access: string; refresh: string; user: { id: string; email: string; name: string; role: string; avatar: string; is_active: boolean; date_joined: string } }
      const data = await apiFetch<RegisterResponse>("/auth/register/", {
        method: "POST",
        body: JSON.stringify({ email, name, password, password2: confirm }),
      })
      storeTokens(data.access, data.refresh, false)
      storeUser(data.user)
      await refreshUser()
      await claimPendingReferral()
      router.push(`${lp}/account`)
    } catch (err: unknown) {
      const apiErr = err as { data?: Record<string, string[]> }
      if (apiErr?.data) {
        const mapped: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(apiErr.data)) {
          mapped[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        }
        setErrors(mapped)
      } else {
        setErrors({ general: "Registration failed. Please try again." })
      }
    } finally {
      setLoading(false)
    }
  }

  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : 3

  const strengthLabel = ["", "Weak", "Good", "Strong"][strength]
  const strengthColor = ["", "bg-dp-accent-cta", "bg-dp-accent-gold", "bg-dp-success"][strength]

  return (
    <SiteShell>
      <div className="dp-container py-12 flex flex-col md:flex-row gap-12 items-center justify-center">

        {/* Left: form */}
        <div className="w-full max-w-md shrink-0">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-sm border border-dp-border-hover bg-dp-bg-elevated mb-4" aria-hidden>
              <span className="block w-6 h-6 rounded-sm border-2" style={{ borderColor: "var(--dp-accent-cta)" }} />
            </div>
            <h1 className="font-display text-4xl text-dp-text-primary tracking-wider mb-2">Create Account</h1>
            <p className="text-[13px] text-dp-text-tertiary">Join 2.5 million art lovers on Koleqcia</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-dp-bg-surface border border-dp-border rounded-sm p-8 flex flex-col gap-5" noValidate>
            {(errors.general || errors.detail) && (
              <p className="text-[12px] text-dp-accent-cta bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm px-3 py-2">
                {errors.general ?? errors.detail}
              </p>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">
                Full Name
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full pl-9 pr-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                />
              </div>
              {errors.name && <p className="text-[11px] text-dp-accent-cta mt-1">{errors.name}</p>}
            </div>

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
              {errors.email && <p className="text-[11px] text-dp-accent-cta mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
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
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${strength >= level ? strengthColor : "bg-dp-border"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-dp-text-tertiary font-semibold">{strengthLabel}</span>
                </div>
              )}
              {errors.password && <p className="text-[11px] text-dp-accent-cta mt-1">{errors.password}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-dp-text-tertiary mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" aria-hidden />
                <input
                  id="confirm"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                />
              </div>
              {errors.confirm && <p className="text-[11px] text-dp-accent-cta mt-1">{errors.confirm}</p>}
            </div>

            {/* Terms */}
            <p className="text-[11px] text-dp-text-tertiary leading-relaxed">
              By creating an account you agree to our{" "}
              <LocalizedLink href="/terms" className="underline hover:text-dp-text-primary transition-colors">Terms of Service</LocalizedLink>
              {" "}and{" "}
              <LocalizedLink href="/privacy" className="underline hover:text-dp-text-primary transition-colors">Privacy Policy</LocalizedLink>.
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                <>Create Free Account <ArrowRight size={14} /></>
              )}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-dp-border" />
              <span className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">or</span>
              <div className="flex-1 border-t border-dp-border" />
            </div>

            <GoogleAuthButton
              mode="signup"
              disabled={loading || googleLoading}
              onSuccess={handleGoogleSuccess}
              onError={(message) => setErrors({ detail: message })}
            />

            <p className="text-center text-[13px] text-dp-text-secondary">
              Already have an account?{" "}
              <LocalizedLink href="/login" className="font-bold text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors">
                Sign in
              </LocalizedLink>
            </p>
          </form>
        </div>

        {/* Right: perks panel — visible from md breakpoint */}
        <div className="hidden md:flex flex-col gap-6 max-w-sm w-full">
          <h2 className="font-display text-4xl text-dp-text-primary leading-tight">
            Why join<br />Koleqcia?
          </h2>
          <ul className="flex flex-col gap-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-dp-success shrink-0 mt-0.5" />
                <span className="text-[13px] text-dp-text-secondary">{perk}</span>
              </li>
            ))}
          </ul>
          <div className="border border-dp-accent-gold/50 rounded-sm p-5 bg-dp-bg-surface flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-dp-accent-gold" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-gold">New member bonus</p>
            </div>
            <p className="text-[13px] text-dp-text-secondary leading-relaxed">
              Sign up today and get <strong className="text-dp-text-primary">5 XP</strong> instantly — plus a{" "}
              <strong className="text-dp-text-primary">10% off</strong> welcome coupon in your inbox.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
