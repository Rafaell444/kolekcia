"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"

type Category = { id: number; name: string; slug: string; image_url: string; count: number }

export default function AdminCategoriesPage(): React.ReactElement {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminFetch<Category[] | PaginatedResponse<Category>>("/admin/categories/")
      .then((d) => { if (!cancelled) setCategories(parseList(d)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function deleteCategory(id: number) {
    await adminFetch(`/admin/categories/${id}/`, { method: "DELETE" }).catch(() => {})
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Categories</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Manage product categories and their cover images.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
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
                <div className="flex gap-1">
                  <button className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors" aria-label="Edit"><Pencil size={12} /></button>
                  <button onClick={() => deleteCategory(c.id)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors" aria-label="Delete"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
