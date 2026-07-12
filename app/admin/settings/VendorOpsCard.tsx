"use client"

import React, { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { Save, Mail, Truck, Plus, Trash2 } from "lucide-react"

type VendorOps = {
  id: number
  name: string
  slug: string
  payment_email: string
  email_template_type?: string
  gift_wrap_price_gel: string
  gift_wrap_price_usd: string
  shipping_email_subject: string
  shipping_email_body: string
  catalog_category_slug: string
}

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

type ProcessingOption = {
  id?: number
  slug: string
  label: string
  price_gel: string
  price_usd: string
  est_days_min: number
  est_days_max: number
  sort_order: number
  is_active: boolean
}

const INPUT_CLS = "px-2.5 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"

function VendorShippingTable({ vendorSlug }: { vendorSlug: string }) {
  const [opts, setOpts] = useState<ShippingOption[]>([])
  const [saving, setSaving] = useState<Record<number, boolean>>({})

  useEffect(() => {
    adminFetch<ShippingOption[]>(`/vendors/me/shipping/?vendor=${vendorSlug}`)
      .then((d) => setOpts(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [vendorSlug])

  async function saveOpt(opt: ShippingOption) {
    setSaving((s) => ({ ...s, [opt.id]: true }))
    try {
      await adminFetch(`/vendors/me/shipping/${opt.id}/?vendor=${vendorSlug}`, {
        method: "PATCH",
        body: JSON.stringify(opt),
      })
    } catch { /* noop */ }
    finally { setSaving((s) => ({ ...s, [opt.id]: false })) }
  }

  async function addOpt(market: string) {
    const created = await adminFetch<ShippingOption>(`/vendors/me/shipping/?vendor=${vendorSlug}`, {
      method: "POST",
      body: JSON.stringify({
        market,
        label: market === "GE" ? "Standard" : "International",
        price: "0",
        est_days_min: 3,
        est_days_max: 7,
        is_active: true,
        sort_order: opts.length,
      }),
    }).catch(() => null)
    if (created) setOpts((prev) => [...prev, created])
  }

  async function deleteOpt(id: number) {
    await adminFetch(`/vendors/me/shipping/${id}/?vendor=${vendorSlug}`, { method: "DELETE" }).catch(() => {})
    setOpts((prev) => prev.filter((o) => o.id !== id))
  }

  function updateOpt(id: number, patch: Partial<ShippingOption>) {
    setOpts((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o))
  }

  const byMarket = (m: string) => opts.filter((o) => o.market === m)

  return (
    <div className="flex flex-col gap-4">
      {(["GE", "OTHER"] as const).map((market) => (
        <div key={market}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">
              {market === "GE" ? "Georgian market (₾ GEL)" : "Other markets ($ USD)"}
            </p>
            <button type="button" onClick={() => void addOpt(market)}
              className="flex items-center gap-1 text-[11px] text-dp-text-secondary hover:text-dp-accent-cta">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-dp-border">
                  {["Label", "Price", "Min days", "Max days", "Active", ""].map((h) => (
                    <th key={h} className="text-left px-2 py-2 text-dp-text-tertiary font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byMarket(market).map((opt) => (
                  <tr key={opt.id} className="border-b border-dp-border/60">
                    <td className="px-2 py-2">
                      <input value={opt.label} onChange={(e) => updateOpt(opt.id, { label: e.target.value })} className={`${INPUT_CLS} w-28`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} step={0.01} value={opt.price}
                        onChange={(e) => updateOpt(opt.id, { price: e.target.value })}
                        className={`${INPUT_CLS} w-20`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={1} value={opt.est_days_min}
                        onChange={(e) => updateOpt(opt.id, { est_days_min: parseInt(e.target.value) || 1 })}
                        className={`${INPUT_CLS} w-16`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={1} value={opt.est_days_max}
                        onChange={(e) => updateOpt(opt.id, { est_days_max: parseInt(e.target.value) || 1 })}
                        className={`${INPUT_CLS} w-16`} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={opt.is_active}
                        onChange={(e) => updateOpt(opt.id, { is_active: e.target.checked })}
                        className="accent-dp-accent-cta w-4 h-4" />
                    </td>
                    <td className="px-2 py-2 flex gap-1">
                      <button type="button" onClick={() => void saveOpt(opt)} disabled={!!saving[opt.id]}
                        className="px-2 py-1 bg-dp-accent-cta text-white text-[10px] font-bold uppercase rounded-sm disabled:opacity-50">
                        {saving[opt.id] ? "…" : "Save"}
                      </button>
                      <button type="button" onClick={() => void deleteOpt(opt.id)} className="p-1 text-dp-text-tertiary hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {byMarket(market).length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-3 text-dp-text-tertiary">No options yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function VendorProcessingTable({ vendorSlug }: { vendorSlug: string }) {
  const [opts, setOpts] = useState<ProcessingOption[]>([])
  const [saving, setSaving] = useState<Record<number | string, boolean>>({})

  useEffect(() => {
    adminFetch<ProcessingOption[]>(`/admin/processing-options/?vendor=${vendorSlug}`)
      .then((d) => setOpts(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [vendorSlug])

  async function saveOpt(opt: ProcessingOption, idx: number) {
    setSaving((s) => ({ ...s, [idx]: true }))
    try {
      if (opt.id) {
        const updated = await adminFetch<ProcessingOption>(`/admin/processing-options/${opt.id}/`, {
          method: "PATCH",
          body: JSON.stringify(opt),
        })
        setOpts((prev) => prev.map((o) => o.id === updated.id ? updated : o))
      } else {
        const created = await adminFetch<ProcessingOption>(`/admin/processing-options/`, {
          method: "POST",
          body: JSON.stringify({ ...opt, vendor_slug: vendorSlug }),
        })
        setOpts((prev) => prev.map((o, i) => i === idx ? created : o))
      }
    } catch { /* noop */ }
    finally { setSaving((s) => ({ ...s, [idx]: false })) }
  }

  async function deleteOpt(id: number) {
    await adminFetch(`/admin/processing-options/${id}/`, { method: "DELETE" }).catch(() => {})
    setOpts((prev) => prev.filter((o) => o.id !== id))
  }

  function updateOpt(idx: number, patch: Partial<ProcessingOption>) {
    setOpts((prev) => prev.map((o, i) => i === idx ? { ...o, ...patch } : o))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-dp-border">
              {["Slug", "Label", "Surcharge ₾", "Surcharge $", "Min days", "Max days", "Active", ""].map((h) => (
                <th key={h} className="text-left px-2 py-2 text-dp-text-tertiary font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opts.map((opt, idx) => (
              <tr key={opt.id ?? idx} className="border-b border-dp-border/60">
                <td className="px-2 py-2"><input value={opt.slug} onChange={(e) => updateOpt(idx, { slug: e.target.value })} className={`${INPUT_CLS} w-24`} /></td>
                <td className="px-2 py-2"><input value={opt.label} onChange={(e) => updateOpt(idx, { label: e.target.value })} className={`${INPUT_CLS} w-28`} /></td>
                <td className="px-2 py-2"><input type="number" min={0} step={0.01} value={opt.price_gel} onChange={(e) => updateOpt(idx, { price_gel: e.target.value })} className={`${INPUT_CLS} w-20`} /></td>
                <td className="px-2 py-2"><input type="number" min={0} step={0.01} value={opt.price_usd} onChange={(e) => updateOpt(idx, { price_usd: e.target.value })} className={`${INPUT_CLS} w-20`} /></td>
                <td className="px-2 py-2"><input type="number" min={1} value={opt.est_days_min} onChange={(e) => updateOpt(idx, { est_days_min: parseInt(e.target.value) || 1 })} className={`${INPUT_CLS} w-16`} /></td>
                <td className="px-2 py-2"><input type="number" min={1} value={opt.est_days_max} onChange={(e) => updateOpt(idx, { est_days_max: parseInt(e.target.value) || 1 })} className={`${INPUT_CLS} w-16`} /></td>
                <td className="px-2 py-2"><input type="checkbox" checked={opt.is_active} onChange={(e) => updateOpt(idx, { is_active: e.target.checked })} className="accent-dp-accent-cta w-4 h-4" /></td>
                <td className="px-2 py-2 flex gap-1">
                  <button type="button" onClick={() => void saveOpt(opt, idx)} disabled={!!saving[idx]}
                    className="px-2 py-1 bg-dp-accent-cta text-white text-[10px] font-bold uppercase rounded-sm disabled:opacity-50">
                    {saving[idx] ? "…" : "Save"}
                  </button>
                  {opt.id && (
                    <button type="button" onClick={() => opt.id && void deleteOpt(opt.id)} className="p-1 text-dp-text-tertiary hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button"
        onClick={() => setOpts((prev) => [...prev, { slug: "", label: "", price_gel: "0", price_usd: "0", est_days_min: 1, est_days_max: 5, sort_order: prev.length, is_active: true }])}
        className="self-start flex items-center gap-1.5 text-[12px] text-dp-text-secondary hover:text-dp-accent-cta">
        <Plus size={13} /> Add option
      </button>
    </div>
  )
}

export function VendorOpsCard({ vendor, showProcessing }: { vendor: VendorOps; showProcessing: boolean }) {
  const [draft, setDraft] = useState(vendor)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setDraft(vendor) }, [vendor])

  async function saveOps() {
    setSaving(true)
    try {
      await adminFetch(`/admin/vendors/${vendor.slug}/ops/`, {
        method: "PATCH",
        body: JSON.stringify({
          payment_email: draft.payment_email,
          gift_wrap_price_gel: draft.gift_wrap_price_gel,
          gift_wrap_price_usd: draft.gift_wrap_price_usd,
          shipping_email_subject: draft.shipping_email_subject,
          shipping_email_body: draft.shipping_email_body,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-dp-border">
        <h3 className="font-display text-xl text-dp-text-primary">{vendor.name}</h3>
        <p className="text-[11px] text-dp-text-tertiary mt-0.5">@{vendor.slug} · {vendor.catalog_category_slug || "vendor"}</p>
      </div>
      <div className="p-5 flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mail size={14} className="text-dp-accent-cta" />
            <p className="text-[12px] font-bold uppercase tracking-widest text-dp-text-tertiary">Email & Notifications</p>
          </div>
          <div className="flex flex-col gap-3 max-w-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Vendor email</label>
              <input type="email" value={draft.payment_email} onChange={(e) => setDraft((d) => ({ ...d, payment_email: e.target.value }))}
                className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
            </div>
            <p className="text-[11px] text-dp-text-tertiary">Template: <strong className="text-dp-text-secondary">{draft.email_template_type ?? "Shipping confirmation"}</strong></p>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Subject</label>
              <input value={draft.shipping_email_subject} onChange={(e) => setDraft((d) => ({ ...d, shipping_email_subject: e.target.value }))}
                className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Body</label>
              <textarea rows={5} value={draft.shipping_email_body} onChange={(e) => setDraft((d) => ({ ...d, shipping_email_body: e.target.value }))}
                className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary resize-none" />
              <p className="text-[11px] text-dp-text-tertiary">Placeholders: {"{{customer_name}}"}, {"{{order_number}}"}, {"{{tracking_code}}"}, {"{{tracking_info}}"}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-3">Gift wrap price</p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Georgian (₾ GEL)</label>
              <input type="number" min={0} step={0.01} value={draft.gift_wrap_price_gel}
                onChange={(e) => setDraft((d) => ({ ...d, gift_wrap_price_gel: e.target.value }))}
                className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Other ($ USD)</label>
              <input type="number" min={0} step={0.01} value={draft.gift_wrap_price_usd}
                onChange={(e) => setDraft((d) => ({ ...d, gift_wrap_price_usd: e.target.value }))}
                className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
            </div>
          </div>
        </div>

        {showProcessing && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Truck size={14} className="text-dp-accent-cta" />
              <p className="text-[12px] font-bold uppercase tracking-widest text-dp-text-tertiary">Wallpanel processing time</p>
            </div>
            <VendorProcessingTable vendorSlug={vendor.slug} />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={14} className="text-dp-accent-cta" />
            <p className="text-[12px] font-bold uppercase tracking-widest text-dp-text-tertiary">Shipping options</p>
          </div>
          <VendorShippingTable vendorSlug={vendor.slug} />
        </div>

        <button type="button" onClick={() => void saveOps()} disabled={saving}
          className="self-start flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50">
          <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save vendor settings"}
        </button>
      </div>
    </div>
  )
}
