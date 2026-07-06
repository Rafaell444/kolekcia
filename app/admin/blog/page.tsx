"use client"

import React, { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-auth"
import { Plus, Save, Trash2 } from "lucide-react"

type BlogPost = {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
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
                <p className="text-[11px] text-dp-text-tertiary">{post.is_published ? "Published" : "Draft"}</p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-5 flex flex-col gap-4">
        <h2 className="font-display text-3xl text-dp-text-primary">{selected ? "Edit Post" : "Create Post"}</h2>
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Post title" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary" />
        <input value={form.cover_image_url} onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))} placeholder="Cover image URL" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary" />
        <textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={3} placeholder="Excerpt" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary" />
        <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={14} placeholder="Content" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-dp-text-primary" />
        <label className="inline-flex items-center gap-2 text-[13px] text-dp-text-secondary">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} />
          Publish immediately
        </label>
        <div className="flex items-center gap-3">
          <button onClick={() => { void save() }} disabled={saving || !form.title.trim() || !form.content.trim()} className="inline-flex items-center gap-2 px-4 py-2 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white rounded-sm text-[12px] font-bold uppercase tracking-widest">
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
