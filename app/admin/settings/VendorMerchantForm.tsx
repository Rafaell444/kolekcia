"use client"

import React, { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { Save } from "lucide-react"

export function VendorMerchantSection() {
  const [merchantId, setMerchantId] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    adminFetch<{ merchant_id?: string }>("/vendors/me/")
      .then((d) => setMerchantId(d.merchant_id ?? ""))
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await adminFetch("/vendors/me/", {
        method: "PATCH",
        body: JSON.stringify({ merchant_id: merchantId }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <p className="text-[13px] text-dp-text-tertiary">
        Your payment processor merchant ID. Used for checkout payments on your products and custom orders.
      </p>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Merchant ID</label>
        <input
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          placeholder="e.g. acct_1234567890"
          className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
        />
      </div>
      <button type="button" onClick={() => void handleSave()} disabled={saving}
        className="self-start flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50">
        <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save Merchant ID"}
      </button>
    </div>
  )
}
