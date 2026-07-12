"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { Plus, Pencil, X } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"
import AdminMediaUpload from "@/components/admin/AdminMediaUpload"

type Category = { id: number; name: string; slug: string; image_url: string; count: number }

const EMPTY = { name: "", slug: "", image_url: "" }

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export default function AdminCategoriesPage(): React.ReactElement {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    adminFetch<Category[] | PaginatedResponse<Category>>("/admin/categories/")
      .then((d) => setCategories(parseList(d)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(c: Category) {
    setEditing(c)
    setForm({ name: c.name, slug: c.slug, image_url: c.image_url ?? "" })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), slug: form.slug.trim() || slugify(form.name), image_url: form.image_url }
      if (editing) {
        const updated = await adminFetch<Category>(`/admin/categories/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        setCategories((prev) => prev.map((c) => (c.id === editing.id ? updated : c)))
      } else {
        const created = await adminFetch<Category>("/admin/categories/", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setCategories((prev) => [...prev, created])
      }
      setShowModal(false)
    } catch {
      alert("Failed to save category.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Categories</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Manage product categories and their cover images.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
          <Plus size={14} /> Add Category
        </button>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1,2,3,4].map((i) => <div key={i} className="h-36 bg-dp-bg-elevated rounded-sm" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <div key={c.id} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
              <div className="relative h-28 bg-dp-bg-elevated">
                {c.image_url && <Image src={c.image_url} alt={c.name} fill className="object-cover opacity-60" sizes="(max-width: 640px) 50vw, 25vw" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <p className="absolute bottom-2 left-3 font-display text-xl text-white">{c.name}</p>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-dp-text-tertiary">Slug: <span className="font-mono text-dp-text-secondary">{c.slug}</span></p>
                  <p className="text-[11px] text-dp-text-tertiary">{c.count} designs</p>
                </div>
                <button onClick={() => openEdit(c)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Edit"><Pencil size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">{editing ? "Edit Category" : "Add Category"}</h2>
              <button onClick={() => setShowModal(false)} className="text-dp-text-tertiary hover:text-dp-text-primary"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-5 flex flex-col gap-4">
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editing ? f.slug : slugify(e.target.value) }))} placeholder="Category name" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
              <input required value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="slug" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] font-mono" />
              <AdminMediaUpload label="Cover image" previewUrl={form.image_url} folder="categories" onUploaded={(url) => setForm((f) => ({ ...f, image_url: url }))} previewClassName="w-full h-28" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
