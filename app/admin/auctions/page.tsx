"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { Gavel, Plus, Pencil, Trash2, Radio } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type AdminAuction = {
  id: string; title: string; artist_name: string; image_url: string
  starting_bid: string; current_bid: string; ends_at: string; is_live: boolean; bid_count: number
}

export default function AdminAuctionsPage(): React.ReactElement {
  const [auctions, setAuctions] = useState<AdminAuction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminFetch<AdminAuction[]>("/admin/auctions/")
      .then((d) => { if (!cancelled) setAuctions(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function deleteAuction(id: string) {
    await adminFetch(`/admin/auctions/${id}/`, { method: "DELETE" }).catch(() => {})
    setAuctions((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Auctions</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">Create and manage live auction listings.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors shrink-0">
          <Plus size={14} /> Create Auction
        </button>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3].map((i) => <div key={i} className="h-64 bg-dp-bg-elevated rounded-sm" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((a) => (
            <div key={a.id} className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
              <div className="aspect-video relative bg-dp-bg-elevated">
                {a.image_url && <Image src={a.image_url} alt={a.title} fill className="object-cover opacity-80" sizes="(max-width: 640px) 100vw, 33vw" />}
                {a.is_live && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-dp-accent-cta rounded-sm text-[10px] font-bold uppercase tracking-widest text-white">
                    <Radio size={9} /> Live
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">{a.artist_name}</p>
                <p className="font-display text-lg text-dp-text-primary leading-tight">{a.title}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Current Bid</p>
                    <p className="font-bold text-dp-text-primary">${parseFloat(a.current_bid || a.starting_bid).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Bids</p>
                    <p className="font-bold text-dp-text-primary flex items-center gap-1"><Gavel size={11} /> {a.bid_count}</p>
                  </div>
                </div>
                <div className="flex gap-1 mt-3">
                  <button className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary text-[11px] rounded-sm transition-colors">
                    <Pencil size={11} /> Edit
                  </button>
                  <button onClick={() => deleteAuction(a.id)} className="w-8 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {auctions.length === 0 && <p className="col-span-3 text-center py-12 text-dp-text-tertiary">No auctions yet.</p>}
        </div>
      )}
    </div>
  )
}
