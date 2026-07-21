"use client"

import React, { useEffect, useState } from "react"
import SiteShell from "@/components/layout/SiteShell"
import { Zap, Award } from "lucide-react"
import { useGamification } from "@/contexts/gamification-context"
import { apiFetch } from "@/lib/api"

type Badge = { id: number; name: string; icon: string; rarity: string; description: string }

const RARITY_COLORS: Record<string, string> = {
  common:    "border-dp-border bg-dp-bg-elevated",
  rare:      "border-blue-400/40 bg-blue-500/10",
  epic:      "border-purple-400/40 bg-purple-500/10",
  legendary: "border-dp-accent-gold/40 bg-dp-accent-gold/10",
}

export default function AwardsPage(): React.ReactElement {
  const { profile, loading: profileLoading } = useGamification()
  const [allBadges, setAllBadges] = useState<Badge[]>([])

  useEffect(() => {
    apiFetch<Badge[]>("/gamification/badges/").then(setAllBadges).catch(() => {})
  }, [])

  const earnedIds = new Set(profile?.earned_badges.map((ub) => ub.badge.id) ?? [])

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-dp-text-primary">Awards & XP</h1>
          <p className="text-[14px] text-dp-text-secondary mt-1">Earn XP with every purchase and unlock exclusive collector badges.</p>
        </div>

        {profileLoading ? (
          <div className="animate-pulse h-24 bg-dp-bg-elevated rounded-sm mb-8" />
        ) : (
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6 mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col items-center gap-1">
              <Zap size={20} className="text-dp-accent-cta" />
              <p className="font-display text-3xl text-dp-text-primary">{(profile?.xp ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Total XP</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Award size={20} className="text-dp-accent-gold" />
              <p className="font-display text-3xl text-dp-text-primary">{profile?.level ?? 1}</p>
              <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Level</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl">🔥</span>
              <p className="font-display text-3xl text-dp-text-primary">{profile?.streak_days ?? 0}</p>
              <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Day Streak</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl">🏅</span>
              <p className="font-display text-3xl text-dp-text-primary">{earnedIds.size}</p>
              <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Badges</p>
            </div>
          </div>
        )}

        {/* Recent XP */}
        {profile && profile.recent_xp.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-2xl text-dp-text-primary mb-4">Recent XP</h2>
            <div className="flex flex-col gap-2">
              {profile.recent_xp.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-4 py-2.5 bg-dp-bg-surface border border-dp-border rounded-sm">
                  <span className="text-[13px] text-dp-text-secondary capitalize">{log.action.replace(/_/g, " ")}</span>
                  <span className="text-[13px] font-bold text-dp-accent-cta">+{log.xp_amount} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Badges */}
        <h2 className="font-display text-2xl text-dp-text-primary mb-4">Badges</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {allBadges.map((badge) => {
            const earned = earnedIds.has(badge.id)
            return (
              <div key={badge.id} className={`border rounded-sm p-4 flex flex-col items-center gap-2 text-center transition-opacity ${RARITY_COLORS[badge.rarity]} ${earned ? "opacity-100" : "opacity-40"}`}>
                <span className="text-3xl" aria-hidden>{badge.icon}</span>
                <p className="text-[13px] font-bold text-dp-text-primary">{badge.name}</p>
                <p className="text-[11px] text-dp-text-tertiary">{badge.description}</p>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${earned ? "bg-dp-accent-cta/20 text-dp-accent-cta" : "bg-dp-bg-elevated text-dp-text-tertiary"}`}>
                  {earned ? "Earned" : badge.rarity}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </SiteShell>
  )
}
