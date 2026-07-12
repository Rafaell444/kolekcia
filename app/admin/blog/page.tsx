"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { adminFetch } from "@/lib/admin-auth"
import { Plus, Save, Trash2, ChevronUp, ChevronDown, ExternalLink } from "lucide-react"
import AdminMediaUpload from "@/components/admin/AdminMediaUpload"

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }

type BlogPost = {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  content_blocks: ContentBlock[]
  cover_image_url: string
  is_published: boolean
  published_at: string | null
}

const EMPTY_FORM = {
  title: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  is_published: false,
  content_blocks: [] as ContentBlock[],
}

export default function AdminBlogPage(): React.ReactElement {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BlogPost | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await adminFetch<BlogPost[]>("/admin/blog/")
    setPosts(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false))
  }, [])

  function startNew() {
    setSelected(null)
    setForm(EMPTY_FORM)
  }

  function edit(post: BlogPost) {
    setSelected(post)
    setForm({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image_url,
      is_published: post.is_published,
      content_blocks: post.content_blocks ?? [],
    })
  }

  function addBlock(type: ContentBlock["type"]) {
    const block: ContentBlock =
      type === "paragraph" ? { type, text: "" }
      : type === "heading" ? { type, text: "" }
      : { type, url: "", caption: "" }
    setForm((f) => ({ ...f, content_blocks: [...f.content_blocks, block] }))
  }

  function updateBlock(i: number, block: ContentBlock) {
    setForm((f) => {
      const next = [...f.content_blocks]
      next[i] = block
      return { ...f, content_blocks: next }
    })
  }

  function removeBlock(i: number) {
    setForm((f) => ({ ...f, content_blocks: f.content_blocks.filter((_, idx) => idx !== i) }))
  }

  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= form.content_blocks.length) return
    setForm((f) => {
      const next = [...f.content_blocks]
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...f, content_blocks: next }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { ...form }
      if (selected) {
        await adminFetch(`/admin/blog/${selected.id}/`, { method: "PATCH", body: JSON.stringify(payload) })
      } else {
        await adminFetch("/admin/blog/", { method: "POST", body: JSON.stringify(payload) })
      }
      await load()
      startNew()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    await adminFetch(`/admin/blog/${id}/`, { method: "DELETE" }).catch(() => {})
    await load()
    if (selected?.id === id) startNew()
  }

  return (
    <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      <section className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-dp-border flex items-center justify-between">
          <h1 className="font-display text-2xl text-dp-text-primary">Blog Posts</h1>
          <button onClick={startNew} className="inline-flex items-center gap-1 px-3 py-1.5 bg-dp-accent-cta text-white rounded-sm text-[11px] font-bold uppercase tracking-widest">
            <Plus size={12} /> New
          </button>
        </div>
        <div className="divide-y divide-dp-border max-h-[70vh] overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-dp-text-tertiary">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="px-4 py-6 text-dp-text-tertiary">No posts yet.</p>
          ) : (
            posts.map((post) => (
              <button key={post.id} onClick={() => edit(post)} className="w-full text-left px-4 py-3 hover:bg-dp-bg-elevated transition-colors">
                <p className="text-[13px] font-semibold text-dp-text-primary truncate">{post.title}</p>
                <p className="text-[11px] text-dp-text-tertiary">{post.is_published ? "Published" : "Hidden / draft"}</p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl text-dp-text-primary">{selected ? "Edit Post" : "Create Post"}</h2>
          {selected?.is_published && selected.slug && (
            <Link href={`/blog/${selected.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[11px] text-dp-accent-cta hover:underline">
              View live <ExternalLink size={12} />
            </Link>
          )}
        </div>
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Post title" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary" />
        <AdminMediaUpload label="Cover image" previewUrl={form.cover_image_url} folder="blog" onUploaded={(url) => setForm((f) => ({ ...f, cover_image_url: url }))} previewClassName="w-full h-36" />
        <textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={3} placeholder="Excerpt" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary" />

        <div className="border border-dp-border rounded-sm p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">Content blocks</h3>
            <div className="flex flex-wrap gap-1">
              {(["paragraph", "heading", "image", "video"] as const).map((t) => (
                <button key={t} type="button" onClick={() => addBlock(t)} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider border border-dp-border rounded-sm hover:border-dp-border-hover">
                  + {t}
                </button>
              ))}
            </div>
          </div>
          {form.content_blocks.map((block, i) => (
            <div key={i} className="p-3 bg-dp-bg-elevated border border-dp-border rounded-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-dp-text-tertiary">{block.type}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveBlock(i, -1)} className="p-1 border border-dp-border rounded-sm"><ChevronUp size={12} /></button>
                  <button type="button" onClick={() => moveBlock(i, 1)} className="p-1 border border-dp-border rounded-sm"><ChevronDown size={12} /></button>
                  <button type="button" onClick={() => removeBlock(i)} className="p-1 border border-red-400/40 text-red-400 rounded-sm"><Trash2 size={12} /></button>
                </div>
              </div>
              {(block.type === "paragraph" || block.type === "heading") && (
                <textarea
                  value={block.text}
                  onChange={(e) => updateBlock(i, { ...block, text: e.target.value })}
                  rows={block.type === "heading" ? 2 : 4}
                  placeholder={block.type === "heading" ? "Heading text" : "Paragraph text"}
                  className="px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] resize-none"
                />
              )}
              {(block.type === "image" || block.type === "video") && (
                <>
                  <AdminMediaUpload
                    label={block.type === "image" ? "Image" : "Video"}
                    previewUrl={block.url}
                    folder="blog"
                    accept={block.type === "video" ? "video/*" : "image/*"}
                    onUploaded={(url) => updateBlock(i, { ...block, url })}
                    previewClassName="w-full h-28"
                  />
                  <input
                    value={block.caption ?? ""}
                    onChange={(e) => updateBlock(i, { ...block, caption: e.target.value })}
                    placeholder="Caption (optional)"
                    className="px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px]"
                  />
                </>
              )}
            </div>
          ))}
          {form.content_blocks.length === 0 && (
            <p className="text-[12px] text-dp-text-tertiary">Add blocks for a rich article layout, or use the fallback text below.</p>
          )}
        </div>

        <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={6} placeholder="Fallback plain content (optional)" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary" />
        <label className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} />
          Published / visible on site
        </label>
        <div className="flex items-center gap-3">
          <button onClick={() => { void save() }} disabled={saving || !form.title.trim()} className="inline-flex items-center gap-2 px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white rounded-sm text-[12px] font-bold uppercase tracking-widest">
            <Save size={13} /> {saving ? "Saving…" : "Save"}
          </button>
          {selected && (
            <button onClick={() => { void remove(selected.id) }} className="inline-flex items-center gap-2 px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-sm text-[12px] font-bold uppercase tracking-widest">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
