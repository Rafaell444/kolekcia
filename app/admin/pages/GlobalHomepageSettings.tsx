"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Plus, Save, Trash2 } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Logo = { name: string; label: string; bg: string; text: string }
type Trust = { id: number; key: string; title: string; description: string; icon: string; logos: Logo[]; sort_order: number; is_active: boolean }
type Brand = { id: number; name: string; abbreviation: string; background: string; text_color: string; link: string; sort_order: number; is_active: boolean }

const input = "w-full px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary"
const label = "text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary"

const EMPTY_TRUST: Omit<Trust, "id"> = {
  key: "",
  title: "",
  description: "",
  icon: "",
  logos: [],
  sort_order: 0,
  is_active: true,
}

const EMPTY_BRAND: Omit<Brand, "id"> = {
  name: "",
  abbreviation: "",
  background: "#111111",
  text_color: "#ffffff",
  link: "",
  sort_order: 0,
  is_active: true,
}

function logosToText(logos: Logo[]) {
  return logos.map((logo) => `${logo.name}|${logo.label}|${logo.bg}|${logo.text}`).join("\n")
}

function textToLogos(text: string): Logo[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", label = name, bg = "#111111", text = "#ffffff"] = line.split("|").map((part) => part.trim())
      return { name, label, bg, text }
    })
}

export default function GlobalHomepageSettings() {
  const [trust, setTrust] = useState<Trust[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [newTrust, setNewTrust] = useState(EMPTY_TRUST)
  const [newBrand, setNewBrand] = useState(EMPTY_BRAND)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    const [t, b] = await Promise.all([
      adminFetch<Trust[]>("/admin/trust-bar/"),
      adminFetch<Brand[]>("/admin/fandoms/"),
    ])
    setTrust(Array.isArray(t) ? t : [])
    setBrands(Array.isArray(b) ? b : [])
  }, [])

  useEffect(() => { void load().catch(() => {}) }, [load])

  async function saveTrust(item: Trust) {
    const updated = await adminFetch<Trust>(`/admin/trust-bar/${item.id}/`, { method: "PATCH", body: JSON.stringify(item) })
    setTrust((all) => all.map((x) => x.id === item.id ? updated : x))
    setMessage("Trust bar saved.")
  }

  async function addTrust(e: React.FormEvent) {
    e.preventDefault()
    const created = await adminFetch<Trust>("/admin/trust-bar/", { method: "POST", body: JSON.stringify(newTrust) })
    setTrust((all) => [...all, created])
    setNewTrust(EMPTY_TRUST)
    setMessage("Trust item added.")
  }

  async function removeTrust(id: number) {
    await adminFetch(`/admin/trust-bar/${id}/`, { method: "DELETE" })
    setTrust((all) => all.filter((x) => x.id !== id))
  }

  async function saveBrand(item: Brand) {
    const updated = await adminFetch<Brand>(`/admin/fandoms/${item.id}/`, { method: "PATCH", body: JSON.stringify(item) })
    setBrands((all) => all.map((x) => x.id === item.id ? updated : x))
    setMessage("Fandom card saved.")
  }

  async function addBrand(e: React.FormEvent) {
    e.preventDefault()
    const created = await adminFetch<Brand>("/admin/fandoms/", { method: "POST", body: JSON.stringify(newBrand) })
    setBrands((all) => [...all, created])
    setNewBrand(EMPTY_BRAND)
    setMessage("Fandom card added.")
  }

  async function removeBrand(id: number) {
    await adminFetch(`/admin/fandoms/${id}/`, { method: "DELETE" })
    setBrands((all) => all.filter((x) => x.id !== id))
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {message && <p className="text-[12px] text-dp-accent-cta">{message}</p>}

      <section className="border border-dp-border rounded-sm p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl text-dp-text-primary">Global Trust Bar</h2>
          <p className="text-[12px] text-dp-text-tertiary mt-1">Edit delivery, payment, return, and logo information shown site-wide.</p>
        </div>
        {trust.map((item) => (
          <div key={item.id} className="border border-dp-border rounded-sm p-3 grid md:grid-cols-2 gap-3">
            <div><p className={label}>Key</p><input className={input} value={item.key} onChange={(e) => setTrust((all) => all.map((x) => x.id === item.id ? { ...x, key: e.target.value } : x))} /></div>
            <div><p className={label}>Title</p><input className={input} value={item.title} onChange={(e) => setTrust((all) => all.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x))} /></div>
            <div className="md:col-span-2"><p className={label}>Description</p><input className={input} value={item.description} onChange={(e) => setTrust((all) => all.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} /></div>
            <div className="md:col-span-2"><p className={label}>Logos: name|label|background|text color, one per line</p><textarea rows={4} className={input} value={logosToText(item.logos)} onChange={(e) => setTrust((all) => all.map((x) => x.id === item.id ? { ...x, logos: textToLogos(e.target.value) } : x))} /></div>
            <div><p className={label}>Sort order</p><input type="number" className={input} value={item.sort_order} onChange={(e) => setTrust((all) => all.map((x) => x.id === item.id ? { ...x, sort_order: Number(e.target.value) } : x))} /></div>
            <label className="flex items-center gap-2 text-[12px] text-dp-text-secondary"><input type="checkbox" checked={item.is_active} onChange={(e) => setTrust((all) => all.map((x) => x.id === item.id ? { ...x, is_active: e.target.checked } : x))} /> Active</label>
            <div className="md:col-span-2 flex gap-2">
              <button type="button" onClick={() => void saveTrust(item)} className="inline-flex items-center gap-1 px-3 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm"><Save size={12} /> Save</button>
              <button type="button" onClick={() => void removeTrust(item.id)} className="px-3 py-2 border border-red-400/40 text-red-400 rounded-sm"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        <form onSubmit={(e) => void addTrust(e)} className="border border-dp-accent-cta/30 rounded-sm p-3 grid md:grid-cols-2 gap-2">
          <input required className={input} value={newTrust.key} onChange={(e) => setNewTrust({ ...newTrust, key: e.target.value })} placeholder="key, e.g. delivery" />
          <input required className={input} value={newTrust.title} onChange={(e) => setNewTrust({ ...newTrust, title: e.target.value })} placeholder="Title" />
          <input className={input} value={newTrust.description} onChange={(e) => setNewTrust({ ...newTrust, description: e.target.value })} placeholder="Description" />
          <button className="inline-flex justify-center items-center gap-1 px-3 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm"><Plus size={12} /> Add trust item</button>
        </form>
      </section>

      <section className="border border-dp-border rounded-sm p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl text-dp-text-primary">Official Metal Posters from 200+ Fandoms</h2>
          <p className="text-[12px] text-dp-text-tertiary mt-1">Add, reorder, hide, and edit the homepage carousel cards.</p>
        </div>
        {brands.map((item) => (
          <div key={item.id} className="border border-dp-border rounded-sm p-3 grid md:grid-cols-3 gap-2">
            <input className={input} value={item.name} onChange={(e) => setBrands((all) => all.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x))} placeholder="Company name" />
            <input className={input} value={item.abbreviation} onChange={(e) => setBrands((all) => all.map((x) => x.id === item.id ? { ...x, abbreviation: e.target.value } : x))} placeholder="Display text" />
            <input className={input} value={item.link} onChange={(e) => setBrands((all) => all.map((x) => x.id === item.id ? { ...x, link: e.target.value } : x))} placeholder="Optional link" />
            <input className={input} value={item.background} onChange={(e) => setBrands((all) => all.map((x) => x.id === item.id ? { ...x, background: e.target.value } : x))} placeholder="Background color" />
            <input className={input} value={item.text_color} onChange={(e) => setBrands((all) => all.map((x) => x.id === item.id ? { ...x, text_color: e.target.value } : x))} placeholder="Text color" />
            <input className={input} type="number" value={item.sort_order} onChange={(e) => setBrands((all) => all.map((x) => x.id === item.id ? { ...x, sort_order: Number(e.target.value) } : x))} />
            <label className="flex items-center gap-2 text-[12px] text-dp-text-secondary"><input type="checkbox" checked={item.is_active} onChange={(e) => setBrands((all) => all.map((x) => x.id === item.id ? { ...x, is_active: e.target.checked } : x))} /> Active</label>
            <div className="md:col-span-2 flex gap-2">
              <button type="button" onClick={() => void saveBrand(item)} className="inline-flex items-center gap-1 px-3 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm"><Save size={12} /> Save</button>
              <button type="button" onClick={() => void removeBrand(item.id)} className="px-3 py-2 border border-red-400/40 text-red-400 rounded-sm"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        <form onSubmit={(e) => void addBrand(e)} className="border border-dp-accent-cta/30 rounded-sm p-3 grid md:grid-cols-3 gap-2">
          <input required className={input} value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} placeholder="New company name" />
          <input required className={input} value={newBrand.abbreviation} onChange={(e) => setNewBrand({ ...newBrand, abbreviation: e.target.value })} placeholder="Display text" />
          <button className="inline-flex justify-center items-center gap-1 px-3 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase rounded-sm"><Plus size={12} /> Add company</button>
        </form>
      </section>
    </div>
  )
}
