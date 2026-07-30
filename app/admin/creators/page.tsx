"use client"

import React, { useEffect, useState } from "react"
import { Check, X, Megaphone, Pencil, Ban, Search } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Application = {
  id: number
  user: string
  user_email: string
  user_name: string
  phone: string
  email: string
  tiktok: string
  facebook: string
  instagram: string
  youtube: string
  country?: string
  status: string
  admin_note: string
  created_at: string
}

type Creator = {
  id: number
  user: string
  user_email: string
  user_name: string
  is_active: boolean
  country?: string
  voucher_code: string | null
  voucher_percent: string | null
  available_balance: string
  lifetime_earned: string
  pending_payout: string
}

type LedgerRow = {
  id: number
  entry_type: string
  amount: string
  currency: string
  order_number: string
  buyer_email: string
  product_subtotal: string | null
  discount_percent: string | null
  original_amount: string | null
  original_currency: string | null
  fx_rate: string | null
  fx_date: string | null
  note: string
  created_at: string
  creator_email?: string
  creator_id?: number
}

type Payout = {
  id: number
  creator_email: string
  amount: string
  currency: string
  status: string
  admin_note: string
  created_at: string
}

type VoucherUse = {
  usage_id: number
  order_id: string
  order_number: string
  order_status: string
  buyer_email: string
  currency: string
  order_total: string
  order_discount: string
  product_subtotal: string
  expected_credit: string
  credited: boolean
  used_at: string | null
  creator_id?: number
  creator_email?: string
  voucher_code?: string | null
  voucher_percent?: string | null
}

type AcceptedUser = {
  user_id: string
  user_email: string
  user_name: string
  country?: string
}

type Tab = "applications" | "creators" | "uses" | "ledger" | "payouts" | "settings"

function errMsg(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback
  const data = (err as { data?: Record<string, unknown> }).data
  if (typeof data?.detail === "string") return data.detail
  return fallback
}

export default function AdminCreatorsPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("applications")
  const [apps, setApps] = useState<Application[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [uses, setUses] = useState<VoucherUse[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [minimum, setMinimum] = useState("200.00")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  // Assign voucher
  const [acceptedUsers, setAcceptedUsers] = useState<AcceptedUser[]>([])
  const [assignUserId, setAssignUserId] = useState("")
  const [assignCode, setAssignCode] = useState("")
  const [assignPercent, setAssignPercent] = useState("15")
  const [saving, setSaving] = useState(false)

  // Edit % inline
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPercent, setEditPercent] = useState("")

  // Applications filters
  const [appStatusFilter, setAppStatusFilter] = useState("")
  const [appSearch, setAppSearch] = useState("")

  // Creators filters
  const [creatorsActiveFilter, setCreatorsActiveFilter] = useState("")
  const [creatorsSearch, setCreatorsSearch] = useState("")
  const [creatorsCountryFilter, setCreatorsCountryFilter] = useState("")

  // Payouts filters
  const [payoutsStatusFilter, setPayoutsStatusFilter] = useState("")
  const [payoutsCreatorId, setPayoutsCreatorId] = useState("")
  const [payoutsDateFrom, setPayoutsDateFrom] = useState("")
  const [payoutsDateTo, setPayoutsDateTo] = useState("")
  const [payoutsSearch, setPayoutsSearch] = useState("")

  // Voucher uses filters
  const [usesCreatorId, setUsesCreatorId] = useState("")
  const [usesOrderStatus, setUsesOrderStatus] = useState("")
  const [usesCredited, setUsesCredited] = useState("")
  const [usesDateFrom, setUsesDateFrom] = useState("")
  const [usesDateTo, setUsesDateTo] = useState("")
  const [usesSearch, setUsesSearch] = useState("")

  // Ledger filters
  const [ledgerCreatorId, setLedgerCreatorId] = useState("")
  const [ledgerEntryType, setLedgerEntryType] = useState("")
  const [ledgerDateFrom, setLedgerDateFrom] = useState("")
  const [ledgerDateTo, setLedgerDateTo] = useState("")
  const [ledgerSearch, setLedgerSearch] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [a, c, p, m, accepted] = await Promise.all([
        adminFetch<Application[]>("/admin/creators/applications/"),
        adminFetch<Creator[]>("/admin/creators/"),
        adminFetch<Payout[]>("/admin/creators/payouts/"),
        adminFetch<{ creator_payout_minimum_gel: string }>("/admin/creators/payout-minimum/"),
        adminFetch<AcceptedUser[]>("/admin/creators/accepted-without-voucher/"),
      ])
      setApps(a)
      setCreators(c)
      setPayouts(p)
      setMinimum(m.creator_payout_minimum_gel)
      setAcceptedUsers(accepted)
    } catch (err) {
      setError(errMsg(err, "Failed to load creator data."))
    } finally {
      setLoading(false)
    }
  }

  async function loadUses() {
    try {
      const params = new URLSearchParams()
      if (usesCreatorId) params.set("creator_id", usesCreatorId)
      if (usesOrderStatus) params.set("order_status", usesOrderStatus)
      if (usesCredited) params.set("credited", usesCredited)
      if (usesDateFrom) params.set("date_from", usesDateFrom)
      if (usesDateTo) params.set("date_to", usesDateTo)
      if (usesSearch) params.set("search", usesSearch)
      const qs = params.toString()
      const u = await adminFetch<VoucherUse[]>(`/admin/creators/voucher-uses/${qs ? `?${qs}` : ""}`)
      setUses(u)
    } catch (err) {
      setError(errMsg(err, "Failed to load voucher uses."))
    }
  }

  async function loadLedger() {
    try {
      const params = new URLSearchParams()
      if (ledgerCreatorId) params.set("creator_id", ledgerCreatorId)
      if (ledgerEntryType) params.set("entry_type", ledgerEntryType)
      if (ledgerDateFrom) params.set("date_from", ledgerDateFrom)
      if (ledgerDateTo) params.set("date_to", ledgerDateTo)
      if (ledgerSearch) params.set("order_number", ledgerSearch)
      const qs = params.toString()
      const l = await adminFetch<LedgerRow[]>(`/admin/creators/ledger/${qs ? `?${qs}` : ""}`)
      setLedger(l)
    } catch (err) {
      setError(errMsg(err, "Failed to load ledger."))
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (tab === "uses") loadUses()
  }, [tab, usesCreatorId, usesOrderStatus, usesCredited, usesDateFrom, usesDateTo, usesSearch])

  useEffect(() => {
    if (tab === "ledger") loadLedger()
  }, [tab, ledgerCreatorId, ledgerEntryType, ledgerDateFrom, ledgerDateTo, ledgerSearch])

  async function reviewApp(id: number, status: "approved" | "rejected") {
    try {
      await adminFetch(`/admin/creators/applications/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (err) {
      setError(errMsg(err, "Failed to update application."))
    }
  }

  async function assignVoucher(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      await adminFetch("/admin/creators/", {
        method: "POST",
        body: JSON.stringify({
          user_id: assignUserId,
          code: assignCode,
          discount_percent: assignPercent,
          is_active: true,
        }),
      })
      setAssignCode("")
      setAssignPercent("15")
      setAssignUserId("")
      await load()
      setTab("creators")
    } catch (err) {
      setError(errMsg(err, "Failed to assign voucher."))
    } finally {
      setSaving(false)
    }
  }

  async function savePercent(creatorId: number) {
    setError("")
    try {
      await adminFetch(`/admin/creators/${creatorId}/`, {
        method: "PATCH",
        body: JSON.stringify({ discount_percent: editPercent }),
      })
      setEditingId(null)
      setEditPercent("")
      await load()
    } catch (err) {
      setError(errMsg(err, "Failed to update %."))
    }
  }

  async function deactivateCreator(creator: Creator) {
    if (!confirm(`Deactivate ${creator.user_name || creator.user_email}? Their voucher will be disabled AND their user account will be deactivated (they won't be able to log in). Ledger history is preserved.`)) return
    setError("")
    try {
      await adminFetch(`/admin/creators/${creator.id}/`, { method: "DELETE" })
      await load()
    } catch (err) {
      setError(errMsg(err, "Failed to deactivate creator."))
    }
  }

  async function processPayout(id: number, status: "paid" | "rejected") {
    try {
      await adminFetch(`/admin/creators/payouts/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (err) {
      setError(errMsg(err, "Failed to process payout."))
    }
  }

  async function saveMinimum(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await adminFetch<{ creator_payout_minimum_gel: string }>("/admin/creators/payout-minimum/", {
        method: "PATCH",
        body: JSON.stringify({ creator_payout_minimum_gel: minimum }),
      })
      setMinimum(res.creator_payout_minimum_gel)
    } catch (err) {
      setError(errMsg(err, "Failed to save minimum."))
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "applications", label: "Applications" },
    { id: "creators", label: "Creators & vouchers" },
    { id: "uses", label: "Voucher uses" },
    { id: "ledger", label: "Earnings log" },
    { id: "payouts", label: "Payouts" },
    { id: "settings", label: "Settings" },
  ]

  // Check if any ledger rows have FX data
  const hasFxData = ledger.some((r) => r.original_currency)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Megaphone size={22} className="text-dp-accent-cta" />
        <div>
          <h1 className="font-display text-3xl text-dp-text-primary">Content creators</h1>
          <p className="text-[13px] text-dp-text-tertiary">Applications, vouchers, earnings ledger, payouts</p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[12px] text-dp-accent-cta">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-dp-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-sm ${
              tab === t.id ? "bg-dp-accent-cta text-white" : "bg-dp-bg-elevated text-dp-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-dp-text-tertiary">Loading…</p>
      ) : tab === "applications" ? (
        <div className="flex flex-col gap-3">
          {/* Applications Filters */}
          <div className="flex flex-wrap gap-2 items-end border border-dp-border rounded-sm p-3 bg-dp-bg-surface">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Status</label>
              <select value={appStatusFilter} onChange={(e) => setAppStatusFilter(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]">
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Search</label>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
                <input
                  type="text"
                  placeholder="Name, email, country…"
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="pl-6 pr-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[180px]"
                />
              </div>
            </div>
          </div>

          {(() => {
            const q = appSearch.toLowerCase()
            const filtered = apps.filter((app) => {
              if (appStatusFilter && app.status !== appStatusFilter) return false
              if (q && !(
                (app.user_name || "").toLowerCase().includes(q) ||
                app.user_email.toLowerCase().includes(q) ||
                (app.country || "").toLowerCase().includes(q) ||
                app.phone.toLowerCase().includes(q) ||
                app.email.toLowerCase().includes(q)
              )) return false
              return true
            })
            if (filtered.length === 0) return <p className="text-[13px] text-dp-text-tertiary">No applications match the current filters.</p>
            return filtered.map((app) => (
            <div key={app.id} className="border border-dp-border rounded-sm p-4 bg-dp-bg-surface flex flex-col gap-2">
              <div className="flex justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-dp-text-primary">{app.user_name || app.user_email}</p>
                  <p className="text-[12px] text-dp-text-tertiary">{app.user_email} · {app.status}{app.country ? ` · ${app.country}` : ""}</p>
                </div>
                {app.status === "pending" && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => reviewApp(app.id, "approved")} className="px-3 py-1.5 bg-dp-success text-white text-[11px] font-bold uppercase rounded-sm flex items-center gap-1">
                      <Check size={12} /> Approve
                    </button>
                    <button type="button" onClick={() => reviewApp(app.id, "rejected")} className="px-3 py-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm flex items-center gap-1">
                      <X size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[12px] text-dp-text-secondary">Phone: {app.phone} · Contact email: {app.email}</p>
              <p className="text-[11px] text-dp-text-tertiary">
                TikTok: {app.tiktok || "—"} · FB: {app.facebook || "—"} · IG: {app.instagram || "—"} · YT: {app.youtube || "—"}
              </p>
              {app.status === "approved" && (
                <p className="text-[11px] text-dp-success">Approved — assign a voucher in "Creators & vouchers" tab</p>
              )}
            </div>
          ))})()}
        </div>
      ) : tab === "creators" ? (
        <div className="flex flex-col gap-6">
          <form onSubmit={assignVoucher} className="border border-dp-border rounded-sm p-4 bg-dp-bg-surface flex flex-col gap-3 max-w-xl">
            <h2 className="font-display text-xl text-dp-text-primary">Assign / update voucher</h2>
            <p className="text-[12px] text-dp-text-tertiary">Select an approved creator from the dropdown. One shared % for buyer discount and creator earnings.</p>
            <select
              required
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
            >
              <option value="">— Select approved creator —</option>
              {acceptedUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_name} ({u.user_email}){u.country ? ` · ${u.country}` : ""}
                </option>
              ))}
            </select>
            {acceptedUsers.length === 0 && (
              <p className="text-[11px] text-dp-text-tertiary">No approved creators without vouchers. Approve an application first.</p>
            )}
            <div className="flex gap-2">
              <input
                required
                value={assignCode}
                onChange={(e) => setAssignCode(e.target.value.toUpperCase())}
                placeholder="VOUCHER CODE"
                className="flex-1 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]"
              />
              <input
                required
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={assignPercent}
                onChange={(e) => setAssignPercent(e.target.value)}
                placeholder="%"
                className="w-24 px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]"
              />
            </div>
            <button type="submit" disabled={saving} className="self-start px-4 py-2 bg-dp-accent-cta text-white text-[12px] font-bold uppercase rounded-sm disabled:opacity-60">
              {saving ? "Saving…" : "Save voucher"}
            </button>
          </form>

          {/* Creators Filters */}
          <div className="flex flex-wrap gap-2 items-end border border-dp-border rounded-sm p-3 bg-dp-bg-surface">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Status</label>
              <select value={creatorsActiveFilter} onChange={(e) => setCreatorsActiveFilter(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Country</label>
              <select value={creatorsCountryFilter} onChange={(e) => setCreatorsCountryFilter(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]">
                <option value="">All</option>
                {[...new Set(creators.map((c) => c.country).filter(Boolean))].sort().map((cc) => (
                  <option key={cc} value={cc}>{cc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Search</label>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
                <input
                  type="text"
                  placeholder="Name, email, voucher code…"
                  value={creatorsSearch}
                  onChange={(e) => setCreatorsSearch(e.target.value)}
                  className="pl-6 pr-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[180px]"
                />
              </div>
            </div>
          </div>

          {(() => {
            const q = creatorsSearch.toLowerCase()
            const filtered = creators.filter((c) => {
              if (creatorsActiveFilter === "active" && !c.is_active) return false
              if (creatorsActiveFilter === "inactive" && c.is_active) return false
              if (creatorsCountryFilter && c.country !== creatorsCountryFilter) return false
              if (q && !(
                (c.user_name || "").toLowerCase().includes(q) ||
                c.user_email.toLowerCase().includes(q) ||
                (c.voucher_code || "").toLowerCase().includes(q)
              )) return false
              return true
            })
            return (
          <div className="overflow-x-auto border border-dp-border rounded-sm">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-dp-bg-elevated text-dp-text-tertiary uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Voucher</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Lifetime</th>
                  <th className="px-3 py-2">Pending payout</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-4 text-center text-dp-text-tertiary">No creators match the current filters.</td></tr>
                ) : filtered.map((c) => (
                  <tr key={c.id} className={`border-t border-dp-border ${!c.is_active ? "opacity-40" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-dp-text-primary">{c.user_name || c.user_email}</div>
                      <div className="text-dp-text-tertiary">{c.user_email}</div>
                      {!c.is_active && <span className="text-[10px] text-dp-accent-cta font-bold">DEACTIVATED</span>}
                    </td>
                    <td className="px-3 py-2 font-mono">{c.country || "—"}</td>
                    <td className="px-3 py-2 font-mono">{c.voucher_code || "—"}</td>
                    <td className="px-3 py-2">
                      {editingId === c.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={editPercent}
                            onChange={(e) => setEditPercent(e.target.value)}
                            className="w-16 px-1 py-0.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); savePercent(c.id) }
                              if (e.key === "Escape") setEditingId(null)
                            }}
                          />
                          <button type="button" onClick={() => savePercent(c.id)} className="text-dp-success" title="Save"><Check size={14} /></button>
                          <button type="button" onClick={() => setEditingId(null)} className="text-dp-text-tertiary" title="Cancel"><X size={14} /></button>
                        </div>
                      ) : (
                        <span>{c.voucher_percent ? `${c.voucher_percent}%` : "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{c.available_balance} {c.country === "GE" ? "GEL" : "GEL"}</td>
                    <td className="px-3 py-2">{c.lifetime_earned} {c.country === "GE" ? "GEL" : "GEL"}</td>
                    <td className="px-3 py-2">{c.pending_payout} {c.country === "GE" ? "GEL" : "GEL"}</td>
                    <td className="px-3 py-2">
                      {c.is_active && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(c.id)
                              setEditPercent(c.voucher_percent || "")
                            }}
                            className="px-2 py-1 bg-dp-bg-elevated border border-dp-border rounded-sm text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-dp-bg-surface"
                            title="Edit %"
                          >
                            <Pencil size={11} /> Edit %
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateCreator(c)}
                            className="px-2 py-1 bg-dp-accent-cta/10 border border-dp-accent-cta/30 text-dp-accent-cta rounded-sm text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-dp-accent-cta/20"
                            title="Deactivate"
                          >
                            <Ban size={11} /> Deactivate
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )
          })()}
        </div>
      ) : tab === "uses" ? (
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-dp-text-tertiary">
            Every order that used a creator voucher. Expected credit becomes available balance when you mark the order <strong className="text-dp-text-secondary">processing</strong> (paid).
          </p>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-end border border-dp-border rounded-sm p-3 bg-dp-bg-surface">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Creator</label>
              <select value={usesCreatorId} onChange={(e) => setUsesCreatorId(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[140px]">
                <option value="">All creators</option>
                {creators.map((c) => <option key={c.id} value={c.id}>{c.user_name || c.user_email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Order status</label>
              <select value={usesOrderStatus} onChange={(e) => setUsesOrderStatus(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]">
                <option value="">All</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Credited</label>
              <select value={usesCredited} onChange={(e) => setUsesCredited(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]">
                <option value="">All</option>
                <option value="true">Credited</option>
                <option value="false">Not credited</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">From</label>
              <input type="date" value={usesDateFrom} onChange={(e) => setUsesDateFrom(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">To</label>
              <input type="date" value={usesDateTo} onChange={(e) => setUsesDateTo(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Search</label>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
                <input
                  type="text"
                  placeholder="Buyer email or order #"
                  value={usesSearch}
                  onChange={(e) => setUsesSearch(e.target.value)}
                  className="pl-6 pr-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[160px]"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-dp-border rounded-sm">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-dp-bg-elevated text-dp-text-tertiary uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Voucher</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Discount</th>
                  <th className="px-3 py-2">Expected credit</th>
                  <th className="px-3 py-2">Credited</th>
                </tr>
              </thead>
              <tbody>
                {uses.map((row) => (
                  <tr key={row.usage_id} className="border-t border-dp-border">
                    <td className="px-3 py-2 whitespace-nowrap">{row.used_at ? new Date(row.used_at).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 font-mono">{row.voucher_code || "—"}{row.voucher_percent ? ` (${row.voucher_percent}%)` : ""}</td>
                    <td className="px-3 py-2">{row.creator_email}</td>
                    <td className="px-3 py-2 font-mono">{row.order_number}</td>
                    <td className="px-3 py-2 capitalize">{row.order_status}</td>
                    <td className="px-3 py-2">{row.buyer_email || "—"}</td>
                    <td className="px-3 py-2">{row.order_discount} {row.currency}</td>
                    <td className="px-3 py-2 font-semibold">{row.expected_credit} {row.currency}</td>
                    <td className="px-3 py-2">{row.credited ? <span className="text-dp-success">Yes</span> : <span className="text-dp-accent-gold">Awaiting paid</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {uses.length === 0 && <p className="text-[13px] text-dp-text-tertiary">No voucher uses match the current filters.</p>}
        </div>
      ) : tab === "ledger" ? (
        <div className="flex flex-col gap-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-end border border-dp-border rounded-sm p-3 bg-dp-bg-surface">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Creator</label>
              <select value={ledgerCreatorId} onChange={(e) => setLedgerCreatorId(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[140px]">
                <option value="">All creators</option>
                {creators.map((c) => <option key={c.id} value={c.id}>{c.user_name || c.user_email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Type</label>
              <select value={ledgerEntryType} onChange={(e) => setLedgerEntryType(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]">
                <option value="">All</option>
                <option value="credit">Credit</option>
                <option value="clawback">Clawback</option>
                <option value="payout_hold">Payout hold</option>
                <option value="payout_paid">Payout paid</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">From</label>
              <input type="date" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">To</label>
              <input type="date" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Order #</label>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search order number"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="pl-6 pr-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[160px]"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-dp-border rounded-sm">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-dp-bg-elevated text-dp-text-tertiary uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  {hasFxData && <th className="px-3 py-2">Original</th>}
                  {hasFxData && <th className="px-3 py-2">FX Rate</th>}
                  {hasFxData && <th className="px-3 py-2">FX Date</th>}
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Product sub</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id} className="border-t border-dp-border align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.creator_email}</td>
                    <td className="px-3 py-2">{row.entry_type}</td>
                    <td className="px-3 py-2 font-semibold">{row.amount} {row.currency}</td>
                    {hasFxData && (
                      <td className="px-3 py-2">
                        {row.original_amount ? `${row.original_amount} ${row.original_currency}` : "—"}
                      </td>
                    )}
                    {hasFxData && <td className="px-3 py-2 font-mono">{row.fx_rate || "—"}</td>}
                    {hasFxData && <td className="px-3 py-2">{row.fx_date || "—"}</td>}
                    <td className="px-3 py-2 font-mono">{row.order_number || "—"}</td>
                    <td className="px-3 py-2">{row.buyer_email || "—"}</td>
                    <td className="px-3 py-2">{row.product_subtotal ?? "—"}</td>
                    <td className="px-3 py-2">{row.discount_percent ?? "—"}</td>
                    <td className="px-3 py-2 text-dp-text-tertiary">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ledger.length === 0 && <p className="text-[13px] text-dp-text-tertiary">No ledger entries match the current filters.</p>}
        </div>
      ) : tab === "payouts" ? (
        <div className="flex flex-col gap-3">
          {/* Payouts Filters */}
          <div className="flex flex-wrap gap-2 items-end border border-dp-border rounded-sm p-3 bg-dp-bg-surface">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Status</label>
              <select value={payoutsStatusFilter} onChange={(e) => setPayoutsStatusFilter(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]">
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Creator</label>
              <select value={payoutsCreatorId} onChange={(e) => setPayoutsCreatorId(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[140px]">
                <option value="">All creators</option>
                {creators.map((c) => <option key={c.id} value={c.user_email}>{c.user_name || c.user_email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">From</label>
              <input type="date" value={payoutsDateFrom} onChange={(e) => setPayoutsDateFrom(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">To</label>
              <input type="date" value={payoutsDateTo} onChange={(e) => setPayoutsDateTo(e.target.value)} className="px-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-dp-text-tertiary mb-0.5">Search</label>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
                <input
                  type="text"
                  placeholder="Creator email, amount…"
                  value={payoutsSearch}
                  onChange={(e) => setPayoutsSearch(e.target.value)}
                  className="pl-6 pr-2 py-1.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] min-w-[160px]"
                />
              </div>
            </div>
          </div>

          {(() => {
            const q = payoutsSearch.toLowerCase()
            const filtered = payouts.filter((p) => {
              if (payoutsStatusFilter && p.status !== payoutsStatusFilter) return false
              if (payoutsCreatorId && p.creator_email !== payoutsCreatorId) return false
              if (payoutsDateFrom && p.created_at < payoutsDateFrom) return false
              if (payoutsDateTo && p.created_at.slice(0, 10) > payoutsDateTo) return false
              if (q && !(
                p.creator_email.toLowerCase().includes(q) ||
                p.amount.includes(q) ||
                p.status.toLowerCase().includes(q)
              )) return false
              return true
            })
            if (filtered.length === 0) return <p className="text-[13px] text-dp-text-tertiary">No payouts match the current filters.</p>
            return filtered.map((p) => (
            <div key={p.id} className="border border-dp-border rounded-sm p-4 bg-dp-bg-surface flex justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-dp-text-primary">{p.creator_email}</p>
                <p className="text-[13px]">{p.amount} {p.currency} · <span className={`capitalize ${p.status === "paid" ? "text-dp-success" : p.status === "rejected" ? "text-dp-accent-cta" : "text-dp-accent-gold"}`}>{p.status}</span></p>
                <p className="text-[11px] text-dp-text-tertiary">{new Date(p.created_at).toLocaleString()}</p>
              </div>
              {p.status === "pending" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => processPayout(p.id, "paid")} className="px-3 py-1.5 bg-dp-success text-white text-[11px] font-bold uppercase rounded-sm">
                    Mark paid
                  </button>
                  <button type="button" onClick={() => processPayout(p.id, "rejected")} className="px-3 py-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))})()}
        </div>
      ) : (
        <form onSubmit={saveMinimum} className="border border-dp-border rounded-sm p-4 bg-dp-bg-surface flex flex-col gap-3 max-w-md">
          <h2 className="font-display text-xl text-dp-text-primary">Payout minimum (GEL)</h2>
          <input
            type="number"
            min="0"
            step="0.01"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
            className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]"
          />
          <button type="submit" className="self-start px-4 py-2 bg-dp-accent-cta text-white text-[12px] font-bold uppercase rounded-sm">
            Save
          </button>
        </form>
      )}
    </div>
  )
}
