"use client"

import React, { useCallback, useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { adminFetch } from "@/lib/admin-auth"
import { Save, FileText, Home, Info, Phone, ChevronRight } from "lucide-react"

const HeroAdminPanel = dynamic(() => import("@/app/admin/hero/HeroAdminPanel"), { ssr: false })
const BannersAdminPanel = dynamic(() => import("@/app/admin/banners/BannersAdminPanel"), { ssr: false })

type PageSection = {
  id: number
  page: string
  section_key: string
  title: string
  content: Record<string, unknown>
  sort_order: number
  is_active: boolean
}

const PAGES = [
  { id: "home", label: "Homepage", Icon: Home },
  { id: "about", label: "About", Icon: Info },
  { id: "contact", label: "Contact", Icon: Phone },
  { id: "product", label: "Product Page", Icon: FileText },
] as const

const HOME_SECTIONS = [
  { id: "hero", label: "Hero Slides" },
  { id: "promo", label: "Promo Strip" },
  { id: "more_ways", label: "More Ways" },
  { id: "video", label: "Video Section" },
  { id: "newsletter", label: "Newsletter" },
  { id: "stats", label: "Social Proof" },
  { id: "blog", label: "Blog", href: "/admin/blog" },
  { id: "categories", label: "Categories", href: "/admin/categories" },
]

function SectionEditor({ section, onSaved }: { section: PageSection; onSaved: () => void }) {
  const [content, setContent] = useState(JSON.stringify(section.content, null, 2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setContent(JSON.stringify(section.content, null, 2))
  }, [section])

  async function save() {
    setSaving(true)
    setError("")
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>
      await adminFetch(`/admin/page-sections/${section.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ content: parsed }),
      })
      onSaved()
    } catch {
      setError("Invalid JSON or save failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-dp-text-primary">{section.title}</h3>
        <span className="text-[10px] uppercase tracking-widest text-dp-text-tertiary">{section.section_key}</span>
      </div>
      <textarea
        rows={16}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full font-mono text-[12px] px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary resize-y"
      />
      {error && <p className="text-[12px] text-red-500">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={saving}
        className="self-start flex items-center gap-2 px-5 py-2 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50">
        <Save size={14} /> {saving ? "Saving…" : "Save section"}
      </button>
    </div>
  )
}

function PagesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = searchParams.get("tab") ?? "home"
  const section = searchParams.get("section") ?? (page === "home" ? "hero" : page === "product" ? "figures" : "hero")

  const [sections, setSections] = useState<PageSection[]>([])
  const [loading, setLoading] = useState(true)

  const loadSections = useCallback(() => {
    setLoading(true)
    adminFetch<PageSection[]>(`/admin/page-sections/?page=${page}`)
      .then((d) => setSections(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { loadSections() }, [loadSections])

  function setTab(tab: string, sec?: string) {
    const params = new URLSearchParams()
    params.set("tab", tab)
    params.set("section", sec ?? "hero")
    router.push(`/admin/pages?${params.toString()}`)
  }

  const cmsSection = sections.find((s) => s.section_key === section)

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Pages</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Edit all homepage, about, and contact sections from one place.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-52 shrink-0 flex flex-col gap-1">
          {PAGES.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-sm text-[13px] font-semibold transition-colors text-left ${page === id ? "bg-dp-accent-cta/10 text-dp-accent-cta border border-dp-accent-cta/30" : "text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated"}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-6">
          <nav className="lg:w-44 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto">
            {(page === "home" ? HOME_SECTIONS : sections.map((s) => ({ id: s.section_key, label: s.title }))).map((item) => (
              "href" in item && item.href ? (
                <Link key={item.id} href={item.href}
                  className="flex items-center justify-between px-3 py-2 rounded-sm text-[12px] font-medium text-dp-text-secondary hover:text-dp-accent-cta whitespace-nowrap">
                  {item.label} <ChevronRight size={12} />
                </Link>
              ) : (
                <button key={item.id} type="button" onClick={() => setTab(page, item.id)}
                  className={`px-3 py-2 rounded-sm text-[12px] font-medium text-left whitespace-nowrap transition-colors ${section === item.id ? "bg-dp-bg-elevated text-dp-text-primary" : "text-dp-text-secondary hover:text-dp-text-primary"}`}>
                  {item.label}
                </button>
              )
            ))}
          </nav>

          <div className="flex-1 bg-dp-bg-surface border border-dp-border rounded-sm p-5 min-w-0">
            {page === "home" && section === "hero" && <HeroAdminPanel embedded />}
            {page === "home" && section === "promo" && <BannersAdminPanel embedded />}
            {page === "home" && section === "blog" && (
              <p className="text-[13px] text-dp-text-secondary">Manage blog posts in the <Link href="/admin/blog" className="text-dp-accent-cta hover:underline">Blog admin</Link>.</p>
            )}
            {page === "home" && section === "categories" && (
              <p className="text-[13px] text-dp-text-secondary">Manage categories in the <Link href="/admin/categories" className="text-dp-accent-cta hover:underline">Categories admin</Link>.</p>
            )}
            {!(page === "home" && ["hero", "promo", "blog", "categories"].includes(section)) && (
              loading ? (
                <div className="animate-pulse h-40 bg-dp-bg-elevated rounded-sm" />
              ) : cmsSection ? (
                <SectionEditor section={cmsSection} onSaved={loadSections} />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-dp-text-tertiary">
                  <FileText size={32} className="opacity-40" />
                  <p className="text-[13px]">No section found. Run <code className="text-dp-accent-cta">py manage.py seed_page_sections</code> to seed defaults.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-dp-text-tertiary">Loading…</div>}>
      <PagesContent />
    </Suspense>
  )
}
