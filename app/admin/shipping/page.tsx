"use client"

import React, { useEffect, useState } from "react"
import { Plus, Trash2, Truck } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type ShippingOption = {
  id: number
  market: string
  label: string
  price: string
  est_days_min: number
  est_days_max: number
  is_active: boolean
  sort_order: number
}

type FormState = {
  market: string
  label: string
  price: string
  est_days_min: string
  est_days_max: string
  is_active: boolean
}

const EMPTY: FormState = {
  market: "GE",
  label: "Standard",
  price: "0",
  est_days_min: "3",
  est_days_max: "7",
  is_active: true,
}

const MARKETS = [
  { value: "GE", label: "Georgian" },
  { value: "OTHER", label: "Other" },
]

function marketLabel(code: string): string {
  return MARKETS.find((m) => m.value === code)?.label ?? code
}

function getAdminErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback
  const data = (err as { data?: Record<string, unknown> }).data
  if (!data) return fallback
  if (typeof data.detail === "string") return data.detail
  for (const value of Object.values(data)) {
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return String(value[0])
  }
  return fallback
}

export default function AdminShippingPage(): React.ReactElement {
  const [options, setOptions] = useState<ShippingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    adminFetch<ShippingOption[]>("/vendors/me/shipping/")
      .then(setOptions)
      .catch((err) => setError(getAdminErrorMessage(err, "Failed to load shipping options.")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function createOption(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const created = await adminFetch<ShippingOption>("/vendors/me/shipping/", {
        method: "POST",
        body: JSON.stringify({
          market: form.market,
          label: form.label,
          price: form.price,
          est_days_min: parseInt(form.est_days_min, 10),
          est_days_max: parseInt(form.est_days_max, 10),
          is_active: form.is_active,
        }),
      })
      setOptions((prev) => [...prev, created])
      setShowForm(false)
      setForm(EMPTY)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to create shipping option."))
    } finally {
      setSaving(false)
    }
  }

  async function deleteOption(id: number) {
    if (!confirm("Delete this shipping option?")) return
    setError("")
    try {
      await adminFetch(`/vendors/me/shipping/${id}/`, { method: "DELETE" })
      setOptions((prev) => prev.filter((o) => o.id !== id))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to delete."))
    }
  }

  async function toggleActive(opt: ShippingOption) {
    setError("")
    try {
      const updated = await adminFetch<ShippingOption>(`/vendors/me/shipping/${opt.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !opt.is_active }),
      })
      setOptions((prev) => prev.map((o) => (o.id === opt.id ? updated : o)))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to update."))
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary flex items-center gap-2">
            <Truck size={24} className="text-dp-accent-cta" /> Shipping
          </h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Set delivery times and prices per market for your store.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setError("") }}
          className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm"
        >
          <Plus size={14} /> Add Option
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[13px] text-dp-accent-cta">{error}</div>
      )}

      {showForm && (
        <form onSubmit={createOption} className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Market</span>
            <select value={form.market} onChange={(e) => setForm((f) => ({ ...f, market: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]">
              {MARKETS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Label</span>
            <input required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Price</span>
            <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Min Days</span>
            <input required type="number" min="1" value={form.est_days_min} onChange={(e) => setForm((f) => ({ ...f, est_days_min: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Max Days</span>
            <input required type="number" min="1" value={form.est_days_max} onChange={(e) => setForm((f) => ({ ...f, est_days_max: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="animate-pulse space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="border-b border-dp-border">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                <th className="text-left px-4 py-3">Market</th>
                <th className="text-left px-4 py-3">Label</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Est. Days</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dp-border text-[13px]">
              {options.map((o) => (
                <tr key={o.id} className="hover:bg-dp-bg-elevated">
                  <td className="px-4 py-3">{marketLabel(o.market)}</td>
                  <td className="px-4 py-3">{o.label}</td>
                  <td className="px-4 py-3">{o.price}</td>
                  <td className="px-4 py-3 text-dp-text-secondary">{o.est_days_min}–{o.est_days_max} days</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleActive(o)} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm ${o.is_active ? "text-dp-success bg-dp-success/10 border-dp-success/30" : "text-dp-text-tertiary border-dp-border"}`}>
                      {o.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => deleteOption(o.id)} className="text-dp-accent-cta hover:bg-dp-accent-cta/10 p-1.5 rounded-sm border border-dp-accent-cta/30">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {options.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No shipping options yet.</p>}
        </div>
      )}
    </div>
  )
}
