"use client"

import React, { useEffect, useState } from "react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Save, Globe, CreditCard, Store } from "lucide-react"
import { VendorStorefrontSection } from "./VendorStorefrontForm"
import { VendorMerchantSection } from "./VendorMerchantForm"
import { VendorOpsCard } from "./VendorOpsCard"

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

function Section({ title, icon: Icon, children }: { title: string; icon: React.FC<{ size?: number; className?: string }>; children: React.ReactNode }) {
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

function GeneralSettingsCard({
  settings,
  onChange,
  onSave,
  saving,
  saved,
}: {
  settings: Record<string, string>
  onChange: (key: string, value: string) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  const fields: Array<{ key: string; label: string; fallback: string; type?: string }> = [
    { key: "site_name", label: "Site Name", fallback: "Koleqcia" },
    { key: "site_url", label: "Site URL", fallback: "https://Koleqcia.com" },
    { key: "support_email", label: "Support Email", fallback: "support@Koleqcia.com", type: "email" },
    { key: "support_phone", label: "Support Phone", fallback: "+995 000 000 000" },
  ]

  return (
    <>
      {fields.map(({ key, label, fallback, type }) => (
        <div key={key} className="flex flex-col gap-1 max-w-md">
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">{label}</label>
          <input
            type={type ?? "text"}
            value={settings[key] ?? fallback}
            onChange={(e) => onChange(key, e.target.value)}
            className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
          />
        </div>
      ))}
      <button type="button" onClick={onSave} disabled={saving}
        className="self-start flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50">
        <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save general settings"}
      </button>
    </>
  )
}

export default function AdminSettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [vendors, setVendors] = useState<VendorOps[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = Boolean(adminUser && !adminUser.is_staff && adminUser.vendor)

  useEffect(() => {
    if (isVendor) return
    let cancelled = false
    adminFetch<Record<string, string>>("/admin/settings/")
      .then((data) => { if (!cancelled) setSettings(data ?? {}) })
      .catch(() => {})
    adminFetch<VendorOps[]>("/vendors/me/")
      .then((data) => { if (!cancelled) setVendors(Array.isArray(data) ? data : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isVendor])

  async function handleSaveGeneral() {
    setSaving(true)
    try {
      await adminFetch("/admin/settings/", {
        method: "PATCH",
        body: JSON.stringify({
          site_name: settings.site_name ?? "Koleqcia",
          site_url: settings.site_url ?? "https://Koleqcia.com",
          support_email: settings.support_email ?? "support@Koleqcia.com",
          support_phone: settings.support_phone ?? "",
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Settings</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">
          {isVendor ? "Manage your store settings." : "Configure platform-wide and per-vendor settings."}
        </p>
      </div>

      {!isVendor && (
        <Section title="General" icon={Globe}>
          <GeneralSettingsCard
            settings={settings}
            onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
            onSave={() => void handleSaveGeneral()}
            saving={saving}
            saved={saved}
          />
        </Section>
      )}

      <VendorStorefrontSection isVendor={isVendor} />

      {isVendor && (
        <Section title="Payments" icon={CreditCard}>
          <VendorMerchantSection />
        </Section>
      )}

      {!isVendor && vendors.length > 0 && (
        <Section title="Vendor Operations" icon={Store}>
          <p className="text-[13px] text-dp-text-tertiary -mt-1">
            Per-vendor email, gift wrap, processing (wallpanels), and shipping. Georgian market uses GEL; all other markets use USD.
          </p>
          <div className="flex flex-col gap-6">
            {vendors.map((v) => (
              <VendorOpsCard
                key={v.id}
                vendor={v}
                showProcessing={v.catalog_category_slug === "wallpanels" || v.slug === "panel-studio"}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
