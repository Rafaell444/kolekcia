"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Zap, LogIn } from "lucide-react"
import { setAdminTokens, setAdminUser, type AdminUser } from "@/lib/admin-auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

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
    <div className="min-h-screen bg-dp-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-sm border-2 flex items-center justify-center bg-dp-bg-surface border-dp-border">
            <Zap size={18} className="text-dp-accent-cta" />
          </div>
          <div>
            <p className="font-display text-2xl text-dp-text-primary tracking-wider">KOLEKCIA</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta">Vendor & Admin Portal</p>
          </div>
        </div>

        <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-8">
          <h1 className="font-display text-3xl text-dp-text-primary mb-1">Sign in</h1>
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
              className="flex items-center justify-center gap-2 w-full py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors mt-1"
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
            <p className="text-[11px] text-dp-text-tertiary text-center">
              Customer? <a href="/" className="text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors">Go to the store →</a>
            </p>
          </div>
        </div>

        {/* Dev hints */}
        <div className="mt-4 p-3 bg-dp-bg-surface/50 border border-dp-border rounded-sm text-[11px] text-dp-text-tertiary space-y-1">
          <p className="font-bold text-dp-text-secondary">Dev accounts:</p>
          <p>Superadmin: <code className="text-dp-accent-cta">admin@kolekcia.com</code> / <code>admin12345</code></p>
          <p>Vendor 1: <code className="text-dp-accent-cta">vendor1@kolekcia.com</code> / <code>vendor12345</code></p>
          <p>Vendor 2: <code className="text-dp-accent-cta">vendor2@kolekcia.com</code> / <code>vendor12345</code></p>
        </div>
      </div>
    </div>
  )
}
