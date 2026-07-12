"use client"

import React, { useEffect, useState } from "react"
import { adminFetch, getAdminToken } from "@/lib/admin-auth"
import { Save, Store, Upload, Mail } from "lucide-react"

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

function MediaUpload({
  label,
  previewUrl,
  kind,
  onUploaded,
}: {
  label: string
  previewUrl: string
  kind: "logo" | "banner"
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("kind", kind)
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const token = getAdminToken()
      const res = await fetch(`${base}/vendors/me/upload/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) throw new Error("upload failed")
      const data = await res.json() as { url: string }
      onUploaded(data.url)
    } catch {
      alert("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">{label}</label>
      <div className="flex items-center gap-4">
        {previewUrl ? (
          <img src={previewUrl} alt={label} className={`object-cover border border-dp-border rounded-sm ${kind === "logo" ? "w-16 h-16" : "w-40 h-20"}`} />
        ) : (
          <div className={`bg-dp-bg-elevated border border-dp-border rounded-sm flex items-center justify-center text-dp-text-tertiary ${kind === "logo" ? "w-16 h-16" : "w-40 h-20"}`}>
            <Upload size={18} />
          </div>
        )}
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-dp-border rounded-sm text-[12px] font-semibold text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
          <Upload size={13} />
          {uploading ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/*" className="sr-only" disabled={uploading}
            onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
        </label>
      </div>
    </div>
  )
}

function EmailTemplateSandbox({ storeName }: { storeName: string }) {
  const [subject, setSubject] = useState(`Your order from ${storeName || "our store"} has shipped!`)
  const [body, setBody] = useState(
    `Hi {{customer_name}},\n\nGreat news — your order {{order_number}} is on its way.\n\nTracking: {{tracking_code}}\n\nThank you for shopping with ${storeName || "us"}!`
  )

  return (
    <div className="border border-dp-border rounded-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dp-border bg-dp-bg-elevated">
        <Mail size={14} className="text-dp-accent-cta" />
        <p className="text-[12px] font-bold uppercase tracking-widest text-dp-text-tertiary">Email template preview</p>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <input value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
          className="w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary resize-none font-mono" />
        <div className="rounded-sm border border-dp-border bg-white text-gray-900 p-5 text-left">
          <p className="text-[11px] text-gray-500 mb-2">Preview</p>
          <p className="font-semibold text-[15px] mb-3">{subject.replace("{{customer_name}}", "Alex").replace("{{order_number}}", "KOL-2024-123456")}</p>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
            {body
              .replace(/\{\{customer_name\}\}/g, "Alex")
              .replace(/\{\{order_number\}\}/g, "KOL-2024-123456")
              .replace(/\{\{tracking_code\}\}/g, "GE123456789GE")}
          </p>
        </div>
      </div>
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
    <div className="flex flex-col gap-5">
      <Field label="Store name" value={draft.name} onChange={(v) => set("name", v)} />
      <MediaUpload label="Logo" previewUrl={draft.logo_url} kind="logo" onUploaded={(url) => set("logo_url", url)} />
      <MediaUpload label="Banner" previewUrl={draft.banner_url} kind="banner" onUploaded={(url) => set("banner_url", url)} />
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
      <EmailTemplateSandbox storeName={draft.name} />
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
          Upload your logo and banner, edit your description and social links, and preview shipping emails.
        </p>
        <VendorStorefrontForm />
      </div>
    </div>
  )
}
