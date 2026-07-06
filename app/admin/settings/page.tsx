"use client"
import React, { useEffect, useState } from "react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Save, Globe, Mail, CreditCard, Bell, Shield, Palette, ShoppingBag, Truck, Plus, Trash2 } from "lucide-react"
import { VendorStorefrontSection } from "./VendorStorefrontForm"

type DeliveryOption = {
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

function DeliveryOptionsManager() {
  const [opts, setOpts] = useState<DeliveryOption[]>([])
  const [saving, setSaving] = useState<Record<number | string, boolean>>({})

  useEffect(() => {
    adminFetch<DeliveryOption[]>("/admin/delivery-options/")
      .then((d) => setOpts(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  async function saveOpt(opt: DeliveryOption, idx: number) {
    setSaving((s) => ({ ...s, [idx]: true }))
    try {
      if (opt.id) {
        const updated = await adminFetch<DeliveryOption>(`/admin/delivery-options/${opt.id}/`, {
          method: "PATCH",
          body: JSON.stringify(opt),
        })
        setOpts((prev) => prev.map((o) => o.id === updated.id ? updated : o))
      } else {
        const created = await adminFetch<DeliveryOption>("/admin/delivery-options/", {
          method: "POST",
          body: JSON.stringify(opt),
        })
        setOpts((prev) => prev.map((o, i) => i === idx ? created : o))
      }
    } catch { /* noop */ }
    finally { setSaving((s) => ({ ...s, [idx]: false })) }
  }

  async function deleteOpt(id: number) {
    await adminFetch(`/admin/delivery-options/${id}/`, { method: "DELETE" }).catch(() => {})
    setOpts((prev) => prev.filter((o) => o.id !== id))
  }

  function updateOpt(idx: number, patch: Partial<DeliveryOption>) {
    setOpts((prev) => prev.map((o, i) => i === idx ? { ...o, ...patch } : o))
  }

  const cls = "px-2.5 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-dp-border">
              {["Slug","Label","Price ₾","Price $","Min days","Max days","Active",""].map((h) => (
                <th key={h} className="text-left px-2 py-2 text-dp-text-tertiary font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opts.map((opt, idx) => (
              <tr key={opt.id ?? idx} className="border-b border-dp-border/60 last:border-0">
                <td className="px-2 py-2">
                  <input value={opt.slug} onChange={(e) => updateOpt(idx, { slug: e.target.value })} className={`${cls} w-24`} />
                </td>
                <td className="px-2 py-2">
                  <input value={opt.label} onChange={(e) => updateOpt(idx, { label: e.target.value })} className={`${cls} w-28`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={0} step={0.01} value={opt.price_gel} onChange={(e) => updateOpt(idx, { price_gel: e.target.value })} className={`${cls} w-20`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={0} step={0.01} value={opt.price_usd} onChange={(e) => updateOpt(idx, { price_usd: e.target.value })} className={`${cls} w-20`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={1} value={opt.est_days_min} onChange={(e) => updateOpt(idx, { est_days_min: parseInt(e.target.value) || 1 })} className={`${cls} w-16`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={1} value={opt.est_days_max} onChange={(e) => updateOpt(idx, { est_days_max: parseInt(e.target.value) || 1 })} className={`${cls} w-16`} />
                </td>
                <td className="px-2 py-2">
                  <input type="checkbox" checked={opt.is_active} onChange={(e) => updateOpt(idx, { is_active: e.target.checked })} className="accent-dp-accent-cta w-4 h-4" />
                </td>
                <td className="px-2 py-2 flex items-center gap-1.5">
                  <button onClick={() => void saveOpt(opt, idx)} disabled={!!saving[idx]}
                    className="px-2.5 py-1 bg-dp-accent-cta text-white text-[10px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50">
                    {saving[idx] ? "…" : "Save"}
                  </button>
                  {opt.id && (
                    <button onClick={() => opt.id && void deleteOpt(opt.id)} className="p-1 text-dp-text-tertiary hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => setOpts((prev) => [...prev, { slug: "", label: "", price_gel: "0", price_usd: "0", est_days_min: 1, est_days_max: 5, sort_order: prev.length, is_active: true }])}
        className="self-start flex items-center gap-1.5 text-[12px] text-dp-text-secondary hover:text-dp-accent-cta transition-colors"
      >
        <Plus size={13} /> Add option
      </button>
    </div>
  )
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

function ProcessingOptionsManager() {
  const [opts, setOpts] = useState<ProcessingOption[]>([])
  const [saving, setSaving] = useState<Record<number | string, boolean>>({})

  useEffect(() => {
    adminFetch<ProcessingOption[]>("/admin/processing-options/")
      .then((d) => setOpts(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

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
        const created = await adminFetch<ProcessingOption>("/admin/processing-options/", {
          method: "POST",
          body: JSON.stringify(opt),
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

  const cls = "px-2.5 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-dp-border">
              {["Slug","Label","Surcharge ₾","Surcharge $","Min days","Max days","Active",""].map((h) => (
                <th key={h} className="text-left px-2 py-2 text-dp-text-tertiary font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opts.map((opt, idx) => (
              <tr key={opt.id ?? idx} className="border-b border-dp-border/60 last:border-0">
                <td className="px-2 py-2">
                  <input value={opt.slug} onChange={(e) => updateOpt(idx, { slug: e.target.value })} className={`${cls} w-24`} />
                </td>
                <td className="px-2 py-2">
                  <input value={opt.label} onChange={(e) => updateOpt(idx, { label: e.target.value })} className={`${cls} w-28`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={0} step={0.01} value={opt.price_gel} onChange={(e) => updateOpt(idx, { price_gel: e.target.value })} className={`${cls} w-20`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={0} step={0.01} value={opt.price_usd} onChange={(e) => updateOpt(idx, { price_usd: e.target.value })} className={`${cls} w-20`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={1} value={opt.est_days_min} onChange={(e) => updateOpt(idx, { est_days_min: parseInt(e.target.value) || 1 })} className={`${cls} w-16`} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={1} value={opt.est_days_max} onChange={(e) => updateOpt(idx, { est_days_max: parseInt(e.target.value) || 1 })} className={`${cls} w-16`} />
                </td>
                <td className="px-2 py-2">
                  <input type="checkbox" checked={opt.is_active} onChange={(e) => updateOpt(idx, { is_active: e.target.checked })} className="accent-dp-accent-cta w-4 h-4" />
                </td>
                <td className="px-2 py-2 flex items-center gap-1.5">
                  <button onClick={() => void saveOpt(opt, idx)} disabled={!!saving[idx]}
                    className="px-2.5 py-1 bg-dp-accent-cta text-white text-[10px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50">
                    {saving[idx] ? "…" : "Save"}
                  </button>
                  {opt.id && (
                    <button onClick={() => opt.id && void deleteOpt(opt.id)} className="p-1 text-dp-text-tertiary hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => setOpts((prev) => [...prev, { slug: "", label: "", price_gel: "0", price_usd: "0", est_days_min: 1, est_days_max: 5, sort_order: prev.length, is_active: true }])}
        className="self-start flex items-center gap-1.5 text-[12px] text-dp-text-secondary hover:text-dp-accent-cta transition-colors"
      >
        <Plus size={13} /> Add option
      </button>
    </div>
  )
}

function ShopSettingsCard() {
  const [giftWrapPrice, setGiftWrapPrice] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    adminFetch<Record<string, string>>("/admin/settings/")
      .then((d) => { if (d.gift_wrap_price) setGiftWrapPrice(d.gift_wrap_price) })
      .catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    try {
      await adminFetch("/admin/settings/", { method: "PATCH", body: JSON.stringify({ gift_wrap_price: giftWrapPrice }) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 max-w-xs">
        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">Gift Wrap Price (USD)</label>
        <input
          type="number" min={0} step={0.01} value={giftWrapPrice}
          onChange={(e) => setGiftWrapPrice(e.target.value)}
          placeholder="5.00"
          className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
        />
        <p className="text-[11px] text-dp-text-tertiary">Added per item when customer selects gift wrapping on the product page.</p>
      </div>
      <button onClick={() => void save()} disabled={saving}
        className="self-start flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50">
        <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save"}
      </button>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.FC<{size?:number;className?:string}>; children: React.ReactNode }) {
  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-dp-border">
        <Icon size={16} className="text-dp-accent-cta" />
        <h2 className="font-display text-xl text-dp-text-primary">{title}</h2>
      </div>
      <div className="p-5 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function Field({ label, defaultValue, type = "text", hint }: { label: string; defaultValue: string; type?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">{label}</label>
      <input type={type} defaultValue={defaultValue}
        className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors max-w-md" />
      {hint && <p className="text-[11px] text-dp-text-tertiary">{hint}</p>}
    </div>
  )
}

function Toggle({ label, sub, defaultOn }: { label: string; sub?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? false)
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-[13px] font-medium text-dp-text-primary">{label}</p>
        {sub && <p className="text-[11px] text-dp-text-tertiary">{sub}</p>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-dp-accent-cta" : "bg-dp-bg-elevated border border-dp-border"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  )
}

type Setting = { key: string; value: string }

export default function AdminSettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = Boolean(adminUser && !adminUser.is_staff && adminUser.vendor)

  useEffect(() => {
    let cancelled = false
    adminFetch<Setting[]>("/admin/settings/")
      .then((arr) => {
        if (!cancelled) {
          const map: Record<string, string> = {}
          arr.forEach((s) => { map[s.key] = s.value })
          setSettings(map)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const entries = Object.entries(settings).map(([key, value]) => ({ key, value }))
      await adminFetch("/admin/settings/bulk-update/", { method: "POST", body: JSON.stringify({ settings: entries }) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  function val(key: string, fallback = "") {
    return settings[key] ?? fallback
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Settings</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">
          {isVendor ? "Manage your store settings." : "Configure platform-wide settings for Kolekcia."}
        </p>
      </div>

      <Section title="General" icon={Globe}>
        <Field label="Site Name"        defaultValue={val("site_name", "Kolekcia")} />
        <Field label="Site URL"         defaultValue={val("site_url", "https://kolekcia.com")} />
        <Field label="Support Email"    defaultValue={val("support_email", "support@kolekcia.com")} type="email" />
        <Field label="Support Phone"    defaultValue={val("support_phone", "+1 (800) 000-0000")} />
      </Section>

      <VendorStorefrontSection isVendor={isVendor} />

      {!isVendor && (
        <Section title="Shop Settings" icon={ShoppingBag}>
          <ShopSettingsCard />
        </Section>
      )}

      {!isVendor && (
        <Section title="Delivery Options" icon={Truck}>
          <p className="text-[13px] text-dp-text-tertiary -mt-1">
            Delivery options shown at checkout. Georgian market can select between standard, fast, and express.
          </p>
          <DeliveryOptionsManager />
        </Section>
      )}

      {!isVendor && (
        <Section title="Wallpanel Processing Time" icon={Truck}>
          <p className="text-[13px] text-dp-text-tertiary -mt-1">
            Processing time packages shown on wallpanel product pages. Customers choose how quickly their panel is built before adding to cart.
          </p>
          <ProcessingOptionsManager />
        </Section>
      )}

      <Section title="Email & Notifications" icon={Mail}>
        <Field label="Shipping Email From"   defaultValue="noreply@kolekcia.com" hint="This address will appear as the sender for shipping confirmations." />
        <Field label="Shipping Email Subject" defaultValue="Your Kolekcia order has shipped! 🚀" />
        <Toggle label="Send order confirmation emails" defaultOn={true} />
        <Toggle label="Send shipping notification with tracking code" defaultOn={true} />
        <Toggle label="Send review request after delivery" defaultOn={true} />
        <Toggle label="Marketing emails" sub="Send promotions and new arrivals" />
      </Section>

      <Section title="Payments" icon={CreditCard}>
        <Field label="Stripe Public Key"  defaultValue="pk_live_••••••••••••••••" hint="Connect your Stripe account for live payments." />
        <Field label="Currency"           defaultValue="USD" />
        <Field label="Free Shipping Over" defaultValue="49" hint="Orders above this amount get free shipping (in your currency)." />
        <Toggle label="Enable Stripe Checkout" defaultOn={true} />
        <Toggle label="Enable PayPal" />
      </Section>

      {!isVendor && (
        <Section title="Notifications" icon={Bell}>
          <Toggle label="Admin notification on new order"   defaultOn={true} />
          <Toggle label="Admin notification on new message" defaultOn={true} />
          <Toggle label="Admin notification on new auction bid" defaultOn={true} />
        </Section>
      )}

      {!isVendor && (
        <Section title="Security" icon={Shield}>
          <Toggle label="Two-factor authentication for admin" defaultOn={true} />
          <Toggle label="Maintenance mode" sub="Show a maintenance page to all visitors" />
          <Toggle label="Registration open" sub="Allow new user sign-ups" defaultOn={true} />
        </Section>
      )}

      {!isVendor && (
        <Section title="Appearance" icon={Palette}>
          <Field label="Primary CTA Colour"  defaultValue="#e63946" hint="Hex code for the main action colour." />
          <Field label="Accent Gold Colour"  defaultValue="#e8a427" />
          <Toggle label="Show promo banner on homepage" defaultOn={true} />
          <Toggle label="Enable dark mode only" defaultOn={true} />
        </Section>
      )}

      <div className="flex justify-start sm:justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
        >
          <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  )
}
