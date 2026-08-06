"use client"

import React, { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { FileText, Home, Info, Phone, Save } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import AdminMediaUpload from "@/components/admin/AdminMediaUpload"

const HeroAdminPanel = dynamic(() => import("@/app/admin/hero/HeroAdminPanel"), { ssr: false })
const BannersAdminPanel = dynamic(() => import("@/app/admin/banners/BannersAdminPanel"), { ssr: false })
const GlobalHomepageSettings = dynamic(() => import("@/app/admin/pages/GlobalHomepageSettings"), { ssr: false })

type PageSection = { id: number; page: string; section_key: string; title: string; content: Record<string, unknown>; content_ka?: Record<string, unknown> | null; content_ru?: Record<string, unknown> | null; sort_order: number; is_active: boolean }
const PAGES = [{ id: "home", label: "Homepage", Icon: Home }, { id: "about", label: "About", Icon: Info }, { id: "contact", label: "Contact", Icon: Phone }, { id: "product", label: "Product Page", Icon: FileText }] as const
const HOME_SECTIONS = [{ id: "hero", label: "Hero Slides" }, { id: "promo", label: "Promo Strip" }, { id: "video", label: "Why Metal Art" }, { id: "newsletter", label: "Newsletter" }, { id: "stats", label: "Social Proof" }, { id: "blog", label: "Blog", href: "/admin/blog" }, { id: "categories", label: "Categories", href: "/admin/categories" }] as const

function setNested(value: unknown, path: (string | number)[], next: string): unknown {
  if (!path.length) return next
  const [head, ...rest] = path
  const copy = Array.isArray(value) ? [...value] : { ...(value as Record<string, unknown>) }
  copy[head as never] = setNested(copy[head as never], rest, next) as never
  return copy
}

function emptyLike(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(emptyLike)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, emptyLike(item)]))
  return ""
}

const IMAGE_KEYS = new Set(["imageUrl", "image_url", "img", "thumb", "avatar", "coverUrl", "cover_url"])

function StructuredFields({ value, path = [], onChange }: { value: unknown; path?: (string | number)[]; onChange: (path: (string | number)[], value: string) => void }) {
  if (Array.isArray(value)) return <div className="flex flex-col gap-3 pl-3 border-l border-dp-border">{value.map((item, i) => <StructuredFields key={i} value={item} path={[...path, i]} onChange={onChange} />)}</div>
  if (!value || typeof value !== "object") return null
  return <div className="flex flex-col gap-3">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="flex flex-col gap-1"><label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">{key.replace(/([A-Z])/g, " $1")}</label>{item && typeof item === "object" ? <StructuredFields value={item} path={[...path, key]} onChange={onChange} /> : key === "id" ? <input value={String(item ?? "Automatic")} readOnly className="w-full px-3 py-2 bg-dp-bg-elevated/60 border border-dp-border rounded-sm text-[12px] text-dp-text-tertiary cursor-not-allowed" /> : IMAGE_KEYS.has(key) ? <AdminMediaUpload label="Image" previewUrl={String(item ?? "")} folder="cms" accept="image/*" previewClassName="w-full h-36" onUploaded={(url) => onChange([...path, key], url)} /> : <input value={String(item ?? "")} onChange={(e) => onChange([...path, key], e.target.value)} className="w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary" />}</div>)}</div>
}

function SectionEditor({ section, onSaved }: { section: PageSection; onSaved: () => void }) {
  const [values, setValues] = useState<[Record<string, unknown>, Record<string, unknown>, Record<string, unknown>]>([section.content, (section.content_ka ?? emptyLike(section.content)) as Record<string, unknown>, (section.content_ru ?? emptyLike(section.content)) as Record<string, unknown>])
  const [saving, setSaving] = useState(false)
  useEffect(() => setValues([section.content, (section.content_ka ?? emptyLike(section.content)) as Record<string, unknown>, (section.content_ru ?? emptyLike(section.content)) as Record<string, unknown>]), [section])
  async function save() { setSaving(true); await adminFetch(`/admin/page-sections/${section.id}/`, { method: "PATCH", body: JSON.stringify({ content: values[0], content_ka: values[1], content_ru: values[2] }) }); setSaving(false); onSaved() }
  return <div className="flex flex-col gap-4"><div className="flex items-center justify-between"><h3 className="font-display text-lg text-dp-text-primary">{section.title}</h3><span className="text-[10px] uppercase tracking-widest text-dp-text-tertiary">{section.section_key}</span></div><div className="grid grid-cols-1 xl:grid-cols-3 gap-4">{["English", "Georgian", "Russian"].map((lang, i) => <div key={lang} className="border border-dp-border rounded-sm p-4"><h4 className="text-[11px] font-bold uppercase tracking-widest mb-4">{lang}</h4><StructuredFields value={values[i]} onChange={(path, next) => setValues((all) => all.map((v, index) => index === i ? setNested(v, path, next) as Record<string, unknown> : v) as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>])} /></div>)}</div><button type="button" onClick={() => void save()} disabled={saving} className="self-start flex items-center gap-2 px-5 py-2 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"><Save size={14} /> {saving ? "Saving..." : "Save section"}</button></div>
}

function PagesContent() {
  const searchParams = useSearchParams(); const router = useRouter()
  const page = searchParams.get("tab") ?? "home"; const section = searchParams.get("section") ?? "hero"
  const [sections, setSections] = useState<PageSection[]>([]); const [loading, setLoading] = useState(true)
  const load = useCallback(() => { setLoading(true); adminFetch<PageSection[]>(`/admin/page-sections/?page=${page}`).then((d) => setSections(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false)) }, [page])
  useEffect(() => { if (page !== "global") load() }, [page, load])
  function defaultSectionFor(tab: string) {
    if (tab === "home") return "hero"
    if (tab === "global") return ""
    const first = sections.find((s) => s.page === tab)
    return first?.section_key ?? "hero"
  }
  function go(tab: string, sec?: string) { router.push(`/admin/pages?tab=${tab}&section=${sec ?? defaultSectionFor(tab)}`) }
  const nav = page === "home" ? HOME_SECTIONS : page === "global" ? [] : sections.map((s) => ({ id: s.section_key, label: s.title }))
  const selectedSection = nav.some((item) => item.id === section) ? section : nav[0]?.id ?? section
  const cmsSection = sections.find((s) => s.section_key === selectedSection)
  return <div className="p-4 sm:p-8 flex flex-col gap-6"><div><h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Pages</h1><p className="text-[13px] text-dp-text-tertiary mt-1">Manage every public page section with structured fields.</p></div><div className="flex gap-2 flex-wrap border-b border-dp-border pb-3">{PAGES.map(({ id, label, Icon }) => <button key={id} onClick={() => go(id)} className={`flex items-center gap-2 px-3 py-2 rounded-sm text-[13px] font-semibold ${page === id ? "bg-dp-accent-cta/10 text-dp-accent-cta" : "text-dp-text-secondary"}`}><Icon size={15} />{label}</button>)}<button onClick={() => go("global")} className={`px-3 py-2 rounded-sm text-[13px] font-semibold ${page === "global" ? "bg-dp-accent-cta/10 text-dp-accent-cta" : "text-dp-text-secondary"}`}>Global Settings</button></div>{page === "global" ? <GlobalHomepageSettings /> : <div className="flex flex-col lg:flex-row gap-6"><nav className="lg:w-52 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto">{nav.map((item) => "href" in item && item.href ? <Link key={item.id} href={item.href} className="px-3 py-2 text-[12px] text-dp-text-secondary">{item.label}</Link> : <button key={item.id} onClick={() => go(page, item.id)} className={`px-3 py-2 rounded-sm text-[12px] text-left ${selectedSection === item.id ? "bg-dp-bg-elevated text-dp-text-primary" : "text-dp-text-secondary"}`}>{item.label}</button>)}</nav><main className="flex-1 bg-dp-bg-surface border border-dp-border rounded-sm p-5 min-w-0">{page === "home" && selectedSection === "hero" ? <HeroAdminPanel embedded /> : page === "home" && selectedSection === "promo" ? <BannersAdminPanel embedded /> : page === "home" && selectedSection === "blog" ? <p>Manage blog posts in <Link href="/admin/blog" className="text-dp-accent-cta">Blog admin</Link>.</p> : page === "home" && selectedSection === "categories" ? <p>Manage categories in <Link href="/admin/categories" className="text-dp-accent-cta">Categories admin</Link>.</p> : loading ? <div className="animate-pulse h-40 bg-dp-bg-elevated rounded-sm" /> : cmsSection ? <SectionEditor section={cmsSection} onSaved={load} /> : <p className="text-dp-text-tertiary">No section found. Run the page seed command.</p>}</main></div>}</div>
}

export default function AdminPagesPage() { return <Suspense fallback={<div className="p-8 text-dp-text-tertiary">Loading...</div>}><PagesContent /></Suspense> }
