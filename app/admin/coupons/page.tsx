"use client"

import React, { useEffect, useState } from "react"
import { Plus, Tag, Trash2, X } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Coupon = {
  id: string
  code: string
  discount_type: string
  discount_value: string
  min_order_value: string
  max_uses: number | null
  is_active: boolean
}

type CouponForm = {
  code: string
  discount_type: "percent" | "fixed"
  discount_value: string
  min_order_value: string
  max_uses: string
  is_active: boolean
}

const EMPTY_FORM: CouponForm = {
  code: "",
  discount_type: "percent",
  discount_value: "10",
  min_order_value: "0",
  max_uses: "",
  is_active: true,
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

export default function AdminCouponsPage(): React.ReactElement {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function loadCoupons() {
    setLoading(true)
    adminFetch<Coupon[]>("/admin/promos/")
      .then((d) => setCoupons(d))
      .catch((err) => setError(getAdminErrorMessage(err, "Failed to load coupons.")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCoupons()
  }, [])

  async function toggleCoupon(id: string, is_active: boolean) {
    setError("")
    try {
      const res = await adminFetch<Coupon>(`/admin/promos/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      })
      setCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: res.is_active } : c)))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to update coupon."))
    }
  }

  async function deleteCoupon(id: string) {
    if (!confirm("Delete this coupon?")) return
    setDeletingId(id)
    setError("")
    try {
      await adminFetch(`/admin/promos/${id}/`, { method: "DELETE" })
      setCoupons((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to delete coupon."))
    } finally {
      setDeletingId(null)
    }
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_order_value: form.min_order_value || "0",
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        is_active: form.is_active,
      }
      const created = await adminFetch<Coupon>("/admin/promos/", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setCoupons((prev) => [created, ...prev])
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to create coupon."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Coupons</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Manage discount codes and promotions.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowModal(true); setError("") }}
          className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors"
        >
          <Plus size={14} /> New Coupon
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[13px] text-dp-accent-cta">
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="border-b border-dp-border">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Discount</th>
                <th className="text-left px-4 py-3">Min Order</th>
                <th className="text-left px-4 py-3">Max Uses</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dp-border text-[13px]">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-dp-bg-elevated transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-dp-text-primary">
                    <span className="inline-flex items-center gap-2">
                      <Tag size={12} className="text-dp-accent-cta" />{c.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dp-text-secondary">
                    {c.discount_type === "percent" ? `${c.discount_value}%` : `$${c.discount_value}`}
                  </td>
                  <td className="px-4 py-3 text-dp-text-secondary">${c.min_order_value}</td>
                  <td className="px-4 py-3 text-dp-text-secondary">{c.max_uses ?? "∞"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleCoupon(c.id, !c.is_active)}
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm transition-colors ${c.is_active ? "text-dp-success bg-dp-success/10 border-dp-success/30" : "text-dp-text-tertiary bg-dp-bg-elevated border-dp-border"}`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => deleteCoupon(c.id)}
                      disabled={deletingId === c.id}
                      className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors disabled:opacity-50"
                      aria-label="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {coupons.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No coupons yet.</p>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">New Coupon</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-dp-text-tertiary hover:text-dp-text-primary">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={createCoupon} className="p-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Code</span>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary uppercase"
                  placeholder="SUMMER20"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Type</span>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as "percent" | "fixed" }))}
                    className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Value</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                    className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Min Order ($)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.min_order_value}
                    onChange={(e) => setForm((f) => ({ ...f, min_order_value: e.target.value }))}
                    className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Max Uses</span>
                  <input
                    type="number"
                    min="1"
                    value={form.max_uses}
                    onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                    placeholder="Unlimited"
                    className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-dp-text-secondary">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                Active immediately
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-dp-border text-dp-text-secondary text-[12px] font-bold uppercase tracking-widest rounded-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60"
                >
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
