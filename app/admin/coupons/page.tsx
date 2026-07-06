"use client"

import React, { useEffect, useState } from "react"
import { Plus, Tag, Trash2 } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Coupon = {
  id: string; code: string; discount_type: string; discount_value: string
  min_order_value: string; max_uses: number; is_active: boolean
}

export default function AdminCouponsPage(): React.ReactElement {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminFetch<Coupon[]>("/admin/promos/")
      .then((d) => { if (!cancelled) setCoupons(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggleCoupon(id: string, is_active: boolean) {
    const res = await adminFetch<Coupon>(`/admin/promos/${id}/`, { method: "PATCH", body: JSON.stringify({ is_active }) }).catch(() => null)
    if (res) setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, is_active: res.is_active } : c))
  }

  async function deleteCoupon(id: string) {
    await adminFetch(`/admin/promos/${id}/`, { method: "DELETE" }).catch(() => {})
    setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Coupons</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Manage discount codes and promotions.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
          <Plus size={14} /> New Coupon
        </button>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}</div>
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
                  <td className="px-4 py-3 font-mono font-bold text-dp-text-primary flex items-center gap-2">
                    <Tag size={12} className="text-dp-accent-cta" />{c.code}
                  </td>
                  <td className="px-4 py-3 text-dp-text-secondary">
                    {c.discount_type === "percent" ? `${c.discount_value}%` : `$${c.discount_value}`}
                  </td>
                  <td className="px-4 py-3 text-dp-text-secondary">${c.min_order_value}</td>
                  <td className="px-4 py-3 text-dp-text-secondary">{c.max_uses}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleCoupon(c.id, !c.is_active)}
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm transition-colors ${c.is_active ? "text-dp-success bg-dp-success/10 border-dp-success/30" : "text-dp-text-tertiary bg-dp-bg-elevated border-dp-border"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteCoupon(c.id)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors" aria-label="Delete">
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
    </div>
  )
}
