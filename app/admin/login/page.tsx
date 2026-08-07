"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Zap, LogIn } from "lucide-react"
import { setAdminTokens, setAdminUser, type AdminUser } from "@/lib/admin-auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
const DEMO_ACCOUNTS = [
  { label: "Superadmin", email: "admin@kolekcia.com", password: "admin12345" },
  { label: "Vendor 1", email: "vendor1@kolekcia.com", password: "vendor12345" },
  { label: "Vendor 2", email: "vendor2@kolekcia.com", password: "vendor12345" },
]

export default function AdminLoginPage(): React.ReactElement {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError("Email and password are required."); return }
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${API_BASE}/admin/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })

      const data = await res.json() as { access?: string; refresh?: string; user?: AdminUser; detail?: string }

      if (!res.ok) {
        setError(data.detail ?? "Login failed.")
        return
      }

      setAdminTokens(data.access!, data.refresh!)
      setAdminUser(data.user!)
      router.push("/admin")
    } catch {
      setError("Network error. Is the server running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dp-bg-base flex items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center text-center gap-3 mb-6 sm:mb-10 sm:flex-row sm:text-left">
          <div className="w-10 h-10 rounded-sm border-2 flex items-center justify-center bg-dp-bg-surface border-dp-border shrink-0">
            <Zap size={18} className="text-dp-accent-cta" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-2xl sm:text-3xl text-dp-text-primary tracking-wider leading-none">KOLEQCIA</p>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-dp-accent-cta mt-1">
              Vendor & Admin Portal
            </p>
          </div>
        </div>

        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 sm:p-8 shadow-sm">
          <h1 className="font-display text-3xl sm:text-4xl text-dp-text-primary mb-1">Sign in</h1>
          <p className="text-[13px] text-dp-text-tertiary mb-7">For staff and vendor accounts only.</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-sm text-[13px] text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="vendor@kolekcia.com"
                className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[14px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 bg-dp-bg-elevated border border-dp-border rounded-sm text-[14px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary hover:text-dp-text-primary transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full min-h-12 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] sm:text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors mt-1"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={15} />
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-dp-border">
            <div className="mb-5 rounded-sm border border-dp-border bg-dp-bg-elevated p-3 sm:p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-dp-text-tertiary">
                Temporary login credentials
              </p>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email)
                      setPassword(account.password)
                      setError("")
                    }}
                    className="w-full rounded-sm border border-dp-border bg-dp-bg-surface px-3 py-2.5 text-left text-[11px] text-dp-text-secondary transition-colors hover:border-dp-border-hover hover:text-dp-text-primary"
                  >
                    <span className="block font-bold uppercase tracking-wider text-dp-text-primary">{account.label}</span>
                    <span className="block break-all sm:break-normal">{account.email}</span>
                    <span className="block text-dp-text-tertiary">{account.password}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-dp-text-tertiary text-center">
              Customer? <a href="/" className="text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors">Go to the store →</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
