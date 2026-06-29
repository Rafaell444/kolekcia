"use client"

import React, { useEffect, useState } from "react"
import { Trophy, Zap, Pencil } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type XPRule = { id: string; action_key: string; xp_amount: number; is_one_time: boolean }
type Badge = { id: string; name: string; icon: string; rarity: string; description: string; trigger_action: string }

const RARITY_COLOR: Record<string, string> = {
  common:    "text-dp-text-secondary bg-dp-bg-elevated border-dp-border",
  rare:      "text-blue-400 bg-blue-400/10 border-blue-400/30",
  epic:      "text-purple-400 bg-purple-400/10 border-purple-400/30",
  legendary: "text-dp-accent-gold bg-dp-accent-gold/10 border-dp-accent-gold/30",
}

export default function AdminGamificationPage(): React.ReactElement {
  const [rules, setRules] = useState<XPRule[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch<XPRule[]>("/admin/gamification/rules/").catch(() => []),
      adminFetch<Badge[]>("/admin/gamification/badges/").catch(() => []),
    ]).then(([r, b]) => {
      if (!cancelled) { setRules(r); setBadges(b) }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">Gamification</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Configure XP rules, badges, levels, and achievements.</p>
      </div>

      <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <h2 className="font-display text-2xl text-dp-text-primary mb-4 flex items-center gap-2"><Zap size={16} className="text-dp-accent-gold" /> XP Rules</h2>
        {loading ? (
          <div className="animate-pulse grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1,2,3,4,5,6].map((i) => <div key={i} className="h-16 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-dp-bg-elevated border border-dp-border rounded-sm">
                <div>
                  <p className="text-[12px] font-semibold text-dp-text-primary">{r.action_key.replace(/_/g, " ")}</p>
                  {r.is_one_time && <p className="text-[10px] text-dp-text-tertiary">One-time</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-dp-accent-gold text-[14px]">+{r.xp_amount} XP</span>
                  <button className="w-6 h-6 flex items-center justify-center text-dp-text-tertiary hover:text-dp-text-primary transition-colors" aria-label="Edit"><Pencil size={11} /></button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <p className="col-span-3 text-center py-6 text-dp-text-tertiary">No XP rules configured.</p>}
          </div>
        )}
      </section>

      <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <h2 className="font-display text-2xl text-dp-text-primary mb-4 flex items-center gap-2"><Trophy size={16} className="text-dp-accent-cta" /> Badges</h2>
        {loading ? (
          <div className="animate-pulse grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map((i) => <div key={i} className="h-24 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {badges.map((b) => (
              <div key={b.id} className="p-4 bg-dp-bg-elevated border border-dp-border rounded-sm flex flex-col gap-2">
                <div className="text-2xl">{b.icon}</div>
                <p className="font-display text-base text-dp-text-primary">{b.name}</p>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm self-start ${RARITY_COLOR[b.rarity] ?? RARITY_COLOR.common}`}>{b.rarity}</span>
                <p className="text-[11px] text-dp-text-tertiary">{b.description}</p>
              </div>
            ))}
            {badges.length === 0 && <p className="col-span-4 text-center py-6 text-dp-text-tertiary">No badges configured.</p>}
          </div>
        )}
      </section>
    </div>
  )
}
