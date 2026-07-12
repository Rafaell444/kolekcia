"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Faq = { id: number; question: string; answer: string; category: string; order: number }

const EMPTY_FAQ: Omit<Faq, "id"> = { question: "", answer: "", category: "", order: 0 }

export default function AdminFaqsPage({ defaultCategory = "" }: { defaultCategory?: string }): React.ReactElement {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Omit<Faq, "id"> | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = defaultCategory ? `?category=${encodeURIComponent(defaultCategory)}` : ""
      const data = await adminFetch<Faq[]>(`/faqs${qs}`)
      setFaqs(Array.isArray(data) ? data : [])
    } catch {
      setFaqs([])
    } finally {
      setLoading(false)
    }
  }, [defaultCategory])

  useEffect(() => { void load() }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    const payload = { ...form, category: defaultCategory || form.category }
    if (editingId) {
      await adminFetch(`/faqs/${editingId}/`, { method: "PATCH", body: JSON.stringify(payload) })
    } else {
      await adminFetch("/faqs/", { method: "POST", body: JSON.stringify(payload) })
    }
    setForm(null)
    setEditingId(null)
    await load()
  }

  async function remove(id: number) {
    await adminFetch(`/faqs/${id}/`, { method: "DELETE" })
    await load()
  }

  const inputCls = "w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
  const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1"
  const title = defaultCategory === "auction" ? "Auction FAQs" : "Site FAQs"

  return (
    <div className={defaultCategory === "auction" ? "" : "p-6 md:p-8 max-w-4xl"}>
      {defaultCategory !== "auction" && (
        <>
          <h1 className="font-display text-3xl text-dp-text-primary mb-2">{title}</h1>
          <p className="text-[13px] text-dp-text-tertiary mb-8">Manage FAQs shown on the /faq page and help sections.</p>
        </>
      )}
      {defaultCategory === "auction" && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-dp-text-primary">{title}</h2>
          <button onClick={() => { setForm({ ...EMPTY_FAQ, category: "auction" }); setEditingId(null) }} className="flex items-center gap-1 px-3 py-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm"><Plus size={12} /> Add FAQ</button>
        </div>
      )}

      {defaultCategory !== "auction" && (
        <button onClick={() => { setForm(EMPTY_FAQ); setEditingId(null) }} className="mb-6 flex items-center gap-1 px-3 py-1.5 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm"><Plus size={12} /> Add FAQ</button>
      )}

      {form && (
        <form onSubmit={save} className="mb-6 p-5 border border-dp-border rounded-sm bg-dp-bg-surface flex flex-col gap-4">
          <div><label className={labelCls}>Question</label><input required className={inputCls} value={form.question} onChange={(e) => setForm((f) => f ? { ...f, question: e.target.value } : f)} /></div>
          <div><label className={labelCls}>Answer</label><textarea required rows={4} className={inputCls} value={form.answer} onChange={(e) => setForm((f) => f ? { ...f, answer: e.target.value } : f)} /></div>
          {!defaultCategory && (
            <div><label className={labelCls}>Category (leave empty for main FAQ page)</label><input className={inputCls} placeholder="auction" value={form.category} onChange={(e) => setForm((f) => f ? { ...f, category: e.target.value } : f)} /></div>
          )}
          <div><label className={labelCls}>Sort order</label><input type="number" className={inputCls} value={form.order} onChange={(e) => setForm((f) => f ? { ...f, order: parseInt(e.target.value, 10) } : f)} /></div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm">Save</button>
            <button type="button" onClick={() => { setForm(null); setEditingId(null) }} className="px-4 py-2 border border-dp-border text-[11px] font-bold uppercase rounded-sm"><X size={12} className="inline" /> Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-[13px] text-dp-text-tertiary">Loading…</p> : (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="flex items-start justify-between gap-4 p-4 border border-dp-border rounded-sm bg-dp-bg-surface">
              <div className="min-w-0">
                <p className="font-semibold text-dp-text-primary">{faq.question}</p>
                <p className="text-[13px] text-dp-text-secondary mt-1 line-clamp-2">{faq.answer}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setForm({ ...faq }); setEditingId(faq.id) }} className="p-2 border border-dp-border rounded-sm"><Pencil size={13} /></button>
                <button onClick={() => remove(faq.id)} className="p-2 border border-dp-border rounded-sm text-red-400"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
