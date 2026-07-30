"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Megaphone, Copy, CheckCircle2 } from "lucide-react"
import { authFetch } from "@/lib/api"

type Application = {
  id: number
  status: string
  phone: string
  email: string
  country?: string
  created_at: string
}

type Creator = {
  voucher_code: string | null
  voucher_percent: string | null
  available_balance: string
  lifetime_earned: string
  pending_payout: string
  payout_minimum_gel: string
  country?: string
}

type LedgerRow = {
  id: number
  entry_type: string
  amount: string
  currency: string
  order_number: string
  created_at: string
  note: string
}

type Redemption = {
  order_number: string
  order_status: string
  buyer_email: string
  currency: string
  expected_credit: string
  credited: boolean
  used_at: string | null
  order_discount: string
}

type MePayload = {
  is_creator: boolean
  application: Application | null
  creator: Creator | null
  payout_minimum_gel: string
  credit_note?: string
  ledger?: LedgerRow[]
  redemptions?: Redemption[]
}

const COUNTRIES = [
  { code: "GE", name: "Georgia" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" },
  { code: "RU", name: "Russia" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "AM", name: "Armenia" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "GR", name: "Greece" },
  { code: "HR", name: "Croatia" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "LT", name: "Lithuania" },
  { code: "LV", name: "Latvia" },
  { code: "MD", name: "Moldova" },
  { code: "NO", name: "Norway" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "SE", name: "Sweden" },
  { code: "SK", name: "Slovakia" },
  { code: "UZ", name: "Uzbekistan" },
]

const EMPTY_FORM = {
  country: "",
  phone: "",
  email: "",
  tiktok: "",
  facebook: "",
  instagram: "",
  youtube: "",
}

export default function CreatorPanel(): React.ReactElement {
  const [data, setData] = useState<MePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch<MePayload>("/creators/me/")
      setData(res)
      if (res.application?.status === "pending") setShowForm(false)
      else if (!res.is_creator) setShowForm(true)
    } catch {
      setError("Could not load creator info. You can still try applying below.")
      setShowForm(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      await authFetch("/creators/apply/", {
        method: "POST",
        body: JSON.stringify(form),
      })
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setError(apiErr?.data?.detail || "Application failed.")
    } finally {
      setSaving(false)
    }
  }

  async function requestPayout() {
    setPayoutLoading(true)
    setError("")
    try {
      await authFetch("/creators/payout/", { method: "POST", body: "{}" })
      await load()
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } }
      setError(apiErr?.data?.detail || "Payout request failed.")
    } finally {
      setPayoutLoading(false)
    }
  }

  async function copyCode() {
    const code = data?.creator?.voucher_code
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return <p className="text-[13px] text-dp-text-tertiary">Loading creator program…</p>
  }

  const creator = data?.creator
  const app = data?.application
  const minimum = parseFloat(data?.payout_minimum_gel || creator?.payout_minimum_gel || "200")
  const available = parseFloat(creator?.available_balance || "0")
  const canPayout = Boolean(creator) && available >= minimum
  const showApply = !data?.is_creator

  // Currency display logic based on creator country
  const isGeorgian = creator?.country === "GE"
  const currencySymbol = isGeorgian ? "₾" : "$"
  const earningsLabel = isGeorgian ? "GEL earned" : "USD earned"

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl text-dp-text-primary flex items-center gap-2">
          <Megaphone size={20} className="text-dp-accent-cta" />
          Creator program
        </h2>
        <p className="text-[13px] text-dp-text-tertiary mt-1">
          Share your voucher. Buyers get a product discount; you earn the same %{isGeorgian ? " in GEL" : ""} when their order is marked paid.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[12px] text-dp-accent-cta">
          {error}
        </div>
      )}

      {showApply && (
        <div className="border border-dp-border rounded-sm p-5 bg-dp-bg-surface flex flex-col gap-4">
          <p className="text-[14px] text-dp-text-primary font-semibold">
            Apply as a content creator
          </p>
          <p className="text-[13px] text-dp-text-secondary">
            Get a personal voucher code. When shoppers use it, they get a product discount and you earn the same %.
          </p>
          {app?.status === "pending" && (
            <p className="text-[13px] text-dp-accent-gold font-semibold">
              Your application is pending review. We'll email you when it's approved.
            </p>
          )}
          {app?.status === "rejected" && (
            <p className="text-[13px] text-dp-accent-cta">
              Your previous application was rejected. You can apply again.
            </p>
          )}
          {app?.status === "pending" ? null : showForm ? (
            <form onSubmit={submitApplication} className="flex flex-col gap-3">
              {/* Country field — required, before phone */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-1">
                  Country *
                </label>
                <select
                  required
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                >
                  <option value="">— Select your country —</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              {(["phone", "email", "tiktok", "facebook", "instagram", "youtube"] as const).map((key) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-1">
                    {key}
                    {(key === "phone" || key === "email") ? " *" : " (optional)"}
                  </label>
                  <input
                    required={key === "phone" || key === "email"}
                    type={key === "email" ? "email" : "text"}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                    placeholder={key === "phone" ? "+995 …" : key === "email" ? "you@example.com" : `Your ${key}`}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                className="self-start px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm disabled:opacity-60"
              >
                {saving ? "Sending…" : "Submit application"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="self-start px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm"
            >
              Apply as content creator
            </button>
          )}
        </div>
      )}

      {creator && (
        <>
          <div className="border border-dp-border rounded-sm p-5 bg-dp-bg-surface grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-dp-text-tertiary font-bold">Your voucher</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-mono text-xl font-bold text-dp-text-primary">{creator.voucher_code || "Pending assignment"}</p>
                {creator.voucher_code && (
                  <button type="button" onClick={copyCode} className="text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Copy code">
                    {copied ? <CheckCircle2 size={16} className="text-dp-success" /> : <Copy size={16} />}
                  </button>
                )}
              </div>
              <p className="text-[13px] text-dp-text-secondary mt-1">
                Discount / your share: <strong>{creator.voucher_percent ?? "—"}%</strong> (products only)
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-dp-text-tertiary font-bold">{earningsLabel}</p>
              <p className="font-display text-3xl text-dp-text-primary mt-1">{creator.available_balance} {currencySymbol}</p>
              <p className="text-[12px] text-dp-text-tertiary">
                Lifetime: {creator.lifetime_earned} {currencySymbol}
                {parseFloat(creator.pending_payout) > 0 ? ` · Pending payout: ${creator.pending_payout} ${currencySymbol}` : ""}
              </p>
              {isGeorgian && (
                <p className="text-[11px] text-dp-text-tertiary mt-1 italic">You are always paid in GEL (converted at NBG daily rate)</p>
              )}
            </div>
          </div>

          <div className="border border-dp-border rounded-sm p-5 bg-dp-bg-surface flex flex-col gap-3">
            <p className="text-[12px] text-dp-text-secondary">
              {data.credit_note || "Earnings are credited when an order that used your voucher is marked paid (processing)."}
            </p>
            <p className="text-[12px] text-dp-text-secondary">
              Minimum payout: <strong>{minimum} GEL</strong>. When you reach it, request a payout — our team will process it manually and email you.
            </p>
            <button
              type="button"
              disabled={!canPayout || payoutLoading}
              onClick={requestPayout}
              className="self-start px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-40 text-white text-[12px] font-black uppercase tracking-widest rounded-sm"
            >
              {payoutLoading ? "Requesting…" : "Request payout"}
            </button>
          </div>

          {data.redemptions && data.redemptions.length > 0 && (
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-2">Voucher uses</h3>
              <ul className="flex flex-col gap-2">
                {data.redemptions.map((row) => (
                  <li key={`${row.order_number}-${row.used_at}`} className="text-[12px] flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-dp-border pb-2">
                    <span className="text-dp-text-secondary">
                      {row.order_number}
                      <span className="text-dp-text-tertiary"> · {row.order_status}</span>
                      {row.buyer_email ? <span className="text-dp-text-tertiary"> · {row.buyer_email}</span> : null}
                    </span>
                    <span className="font-semibold text-dp-text-primary">
                      {row.credited ? (
                        <span className="text-dp-success">+{row.expected_credit} {row.currency} credited</span>
                      ) : (
                        <span className="text-dp-accent-gold">{row.expected_credit} {row.currency} pending (awaiting paid)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.ledger && data.ledger.length > 0 && (
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-2">Recent activity</h3>
              <ul className="flex flex-col gap-2">
                {data.ledger.slice(0, 15).map((row) => (
                  <li key={row.id} className="text-[12px] flex justify-between gap-3 border-b border-dp-border pb-2">
                    <span className="text-dp-text-secondary">
                      {row.entry_type}
                      {row.order_number ? ` · ${row.order_number}` : ""}
                      <span className="text-dp-text-tertiary"> · {new Date(row.created_at).toLocaleDateString()}</span>
                    </span>
                    <span className="font-semibold text-dp-text-primary">{row.amount} {row.currency}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
