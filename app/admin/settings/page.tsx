"use client"
import React, { useEffect, useState } from "react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Save, Globe, Mail, CreditCard, Bell, Shield, Palette } from "lucide-react"
import { VendorStorefrontSection } from "./VendorStorefrontForm"

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
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">Settings</h1>
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

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[13px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
        >
          <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  )
}
