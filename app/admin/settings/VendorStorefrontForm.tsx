"use client"

import React, { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { Save, Store } from "lucide-react"

type VendorProfile = {
  name: string
  slug: string
  logo_url: string
  banner_url: string
  description: string
  catalog_category_slug: string
  social_instagram: string
  social_facebook: string
  social_tiktok: string
  social_youtube: string
}

const EMPTY: VendorProfile = {
  name: "", slug: "", logo_url: "", banner_url: "", description: "", catalog_category_slug: "",
  social_instagram: "", social_facebook: "", social_tiktok: "", social_youtube: "",
}

function Field({
  label, value, onChange, multiline = false, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  hint?: string
}) {
  const cls = "w-full px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors"
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">{label}</label>
      {multiline ? (
        <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-none`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
      {hint ? <p className="text-[11px] text-dp-text-tertiary">{hint}</p> : null}
    </div>
  )
}

export function VendorStorefrontForm({
  vendorSlug,
  allowCategory = false,
  onSaved,
}: {
  vendorSlug?: string
  allowCategory?: boolean
  onSaved?: () => void
}) {
  const [draft, setDraft] = useState<VendorProfile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = vendorSlug
      ? adminFetch<VendorProfile[]>(`/vendors/me/`).then((list) => list.find((v) => v.slug === vendorSlug) ?? null)
      : adminFetch<VendorProfile>(`/vendors/me/`)

    Promise.resolve(load)
      .then((data) => {
        if (!cancelled && data) setDraft({ ...EMPTY, ...data })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [vendorSlug])

  async function handleSave() {
    setSaving(true)
    try {
      const endpoint = vendorSlug ? `/vendors/${vendorSlug}/` : "/vendors/me/"
      await adminFetch(endpoint, { method: "PATCH", body: JSON.stringify(draft) })
      setSaved(true)
      onSaved?.()
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  if (loading) return <p className="text-[13px] text-dp-text-tertiary">Loading storefront…</p>

  function set<K extends keyof VendorProfile>(key: K, value: VendorProfile[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Store name" value={draft.name} onChange={(v) => set("name", v)} />
      <Field label="Logo URL" value={draft.logo_url} onChange={(v) => set("logo_url", v)} hint="Square logo shown on category pages." />
      <Field label="Banner URL" value={draft.banner_url} onChange={(v) => set("banner_url", v)} hint="Wide banner image for your category page header." />
      <Field label="Short description" value={draft.description} onChange={(v) => set("description", v)} multiline />
      {allowCategory && (
        <Field label="Catalog category slug" value={draft.catalog_category_slug} onChange={(v) => set("catalog_category_slug", v)} hint="e.g. figures or wallpanels" />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Facebook" value={draft.social_facebook} onChange={(v) => set("social_facebook", v)} />
        <Field label="Instagram" value={draft.social_instagram} onChange={(v) => set("social_instagram", v)} />
        <Field label="TikTok" value={draft.social_tiktok} onChange={(v) => set("social_tiktok", v)} />
        <Field label="YouTube" value={draft.social_youtube} onChange={(v) => set("social_youtube", v)} />
      </div>
      <button
        type="button"
        onClick={() => { void handleSave() }}
        disabled={saving}
        className="self-start flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
      >
        <Save size={14} /> {saved ? "Saved!" : saving ? "Saving…" : "Save Storefront"}
      </button>
    </div>
  )
}

export function VendorStorefrontSection({ isVendor }: { isVendor: boolean }) {
  if (!isVendor) return null
  return (
    <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-dp-border">
        <Store size={16} className="text-dp-accent-cta" />
        <h2 className="font-display text-xl text-dp-text-primary">Storefront</h2>
      </div>
      <div className="p-5">
        <p className="text-[13px] text-dp-text-tertiary mb-4">
          Logo, banner, company description and social links shown on your category catalog page.
        </p>
        <VendorStorefrontForm />
      </div>
    </div>
  )
}
