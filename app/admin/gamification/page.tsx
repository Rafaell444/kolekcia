"use client"

import React, { useEffect, useState } from "react"
import { Trophy, Zap, Pencil, Plus, Trash2, X } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"

type XPRule = {
  id: string
  action_key: string
  xp_amount: number
  is_one_time: boolean
  description: string
}
type Promo = { id: number; code: string }
type Badge = {
  id: string
  name: string
  icon: string
  rarity: string
  description: string
  trigger_action: string
  prize_promo_id?: number | null
  prize_promo_code?: string | null
  prize_description?: string
}

type RuleForm = {
  action_key: string
  xp_amount: string
  is_one_time: boolean
  description: string
}

type BadgeForm = {
  name: string
  icon: string
  rarity: string
  description: string
  trigger_action: string
  prize_promo_id: string
  prize_description: string
}

const EMPTY_RULE: RuleForm = {
  action_key: "",
  xp_amount: "10",
  is_one_time: false,
  description: "",
}

const EMPTY_BADGE: BadgeForm = {
  name: "",
  icon: "🏆",
  rarity: "common",
  description: "",
  trigger_action: "",
  prize_promo_id: "",
  prize_description: "",
}

const RARITY_COLOR: Record<string, string> = {
  common:    "text-dp-text-secondary bg-dp-bg-elevated border-dp-border",
  rare:      "text-blue-400 bg-blue-400/10 border-blue-400/30",
  epic:      "text-purple-400 bg-purple-400/10 border-purple-400/30",
  legendary: "text-dp-accent-gold bg-dp-accent-gold/10 border-dp-accent-gold/30",
}

function getAdminErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback
  const data = (err as { data?: Record<string, unknown> }).data
  if (!data) return fallback
  if (typeof data.detail === "string") return data.detail
  for (const value of Object.values(data)) {
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return String(value[0])
  }
  return fallback
}

export default function AdminGamificationPage(): React.ReactElement {
  const [rules, setRules] = useState<XPRule[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [editingRule, setEditingRule] = useState<XPRule | null>(null)
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null)
  const [ruleForm, setRuleForm] = useState<RuleForm>(EMPTY_RULE)
  const [badgeForm, setBadgeForm] = useState<BadgeForm>(EMPTY_BADGE)
  const [badgeModalError, setBadgeModalError] = useState("")
  const [saving, setSaving] = useState(false)

  function loadData() {
    setLoading(true)
    Promise.all([
      adminFetch<XPRule[]>("/admin/gamification/xp-rules/"),
      adminFetch<Badge[]>("/admin/gamification/badges/"),
      adminFetch<Promo[] | PaginatedResponse<Promo>>("/admin/promos/"),
    ])
      .then(([r, b, p]) => { setRules(r); setBadges(b); setPromos(parseList(p)) })
      .catch((err) => setError(getAdminErrorMessage(err, "Failed to load gamification data.")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateRule() {
    setEditingRule(null)
    setRuleForm(EMPTY_RULE)
    setShowRuleModal(true)
    setError("")
  }

  function openEditRule(rule: XPRule) {
    setEditingRule(rule)
    setRuleForm({
      action_key: rule.action_key,
      xp_amount: String(rule.xp_amount),
      is_one_time: rule.is_one_time,
      description: rule.description ?? "",
    })
    setShowRuleModal(true)
    setError("")
  }

  function openCreateBadge() {
    setEditingBadge(null)
    setBadgeForm(EMPTY_BADGE)
    setBadgeModalError("")
    setShowBadgeModal(true)
    setError("")
  }

  function openEditBadge(badge: Badge) {
    setEditingBadge(badge)
    setBadgeForm({
      name: badge.name,
      icon: badge.icon,
      rarity: badge.rarity,
      description: badge.description,
      trigger_action: badge.trigger_action,
      prize_promo_id: badge.prize_promo_id ? String(badge.prize_promo_id) : "",
      prize_description: badge.prize_description ?? "",
    })
    setBadgeModalError("")
    setShowBadgeModal(true)
    setError("")
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const payload = {
      action_key: ruleForm.action_key.trim(),
      xp_amount: parseInt(ruleForm.xp_amount, 10),
      is_one_time: ruleForm.is_one_time,
      description: ruleForm.description.trim(),
    }
    try {
      if (editingRule) {
        const updated = await adminFetch<XPRule>(`/admin/gamification/xp-rules/${editingRule.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? updated : r)))
      } else {
        const created = await adminFetch<XPRule>("/admin/gamification/xp-rules/", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setRules((prev) => [...prev, created].sort((a, b) => a.action_key.localeCompare(b.action_key)))
      }
      setShowRuleModal(false)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to save XP rule."))
    } finally {
      setSaving(false)
    }
  }

  async function saveBadge(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    setBadgeModalError("")
    const promoRaw = badgeForm.prize_promo_id.trim()
    const promoId = promoRaw ? Number(promoRaw) : null
    if (promoRaw && Number.isNaN(promoId)) {
      setBadgeModalError("Please select a valid promo code.")
      setSaving(false)
      return
    }
    const payload = {
      name: badgeForm.name.trim(),
      icon: badgeForm.icon.trim(),
      rarity: badgeForm.rarity,
      description: badgeForm.description.trim(),
      trigger_action: badgeForm.trigger_action.trim(),
      prize_description: badgeForm.prize_description.trim(),
      prize_promo_id: promoId,
    }
    try {
      if (editingBadge) {
        const updated = await adminFetch<Badge>(`/admin/gamification/badges/${editingBadge.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        setBadges((prev) => prev.map((b) => (String(b.id) === String(editingBadge.id) ? updated : b)))
      } else {
        const created = await adminFetch<Badge>("/admin/gamification/badges/", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setBadges((prev) => [...prev, created])
      }
      setShowBadgeModal(false)
    } catch (err) {
      const msg = getAdminErrorMessage(err, "Failed to save badge.")
      setBadgeModalError(msg)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRule(rule: XPRule) {
    if (!confirm(`Delete XP rule "${rule.action_key}"?`)) return
    setError("")
    try {
      await adminFetch(`/admin/gamification/xp-rules/${rule.id}/`, { method: "DELETE" })
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to delete XP rule."))
    }
  }

  async function deleteBadge(badge: Badge) {
    if (!confirm(`Delete badge "${badge.name}"?`)) return
    setError("")
    try {
      await adminFetch(`/admin/gamification/badges/${badge.id}/`, { method: "DELETE" })
      setBadges((prev) => prev.filter((b) => b.id !== badge.id))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to delete badge."))
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Gamification</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Configure XP rules, badges, levels, and achievements.</p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[13px] text-dp-accent-cta">
          {error}
        </div>
      )}

      <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-dp-text-primary flex items-center gap-2">
            <Zap size={16} className="text-dp-accent-gold" /> XP Rules
          </h2>
          <button type="button" onClick={openCreateRule} className="flex items-center gap-1.5 px-3 py-1.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] font-bold uppercase tracking-widest rounded-sm">
            <Plus size={12} /> New Rule
          </button>
        </div>
        {loading ? (
          <div className="animate-pulse grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-16 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-dp-bg-elevated border border-dp-border rounded-sm">
                <div className="min-w-0 pr-2">
                  <p className="text-[12px] font-semibold text-dp-text-primary">{r.action_key.replace(/_/g, " ")}</p>
                  {r.description && <p className="text-[10px] text-dp-text-tertiary truncate">{r.description}</p>}
                  {r.is_one_time && <p className="text-[10px] text-dp-text-tertiary">One-time</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-bold text-dp-accent-gold text-[14px]">+{r.xp_amount} XP</span>
                  <button type="button" onClick={() => openEditRule(r)} className="w-6 h-6 flex items-center justify-center text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Edit"><Pencil size={11} /></button>
                  <button type="button" onClick={() => deleteRule(r)} className="w-6 h-6 flex items-center justify-center text-dp-accent-cta hover:text-dp-accent-cta-hover" aria-label="Delete"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <p className="col-span-3 text-center py-6 text-dp-text-tertiary">No XP rules configured.</p>}
          </div>
        )}
      </section>

      <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-dp-text-primary flex items-center gap-2"><Trophy size={16} className="text-dp-accent-cta" /> Badges</h2>
          <button type="button" onClick={openCreateBadge} className="flex items-center gap-1.5 px-3 py-1.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[11px] font-bold uppercase tracking-widest rounded-sm">
            <Plus size={12} /> New Badge
          </button>
        </div>
        {loading ? (
          <div className="animate-pulse grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {badges.map((b) => (
              <div key={b.id} className="p-4 bg-dp-bg-elevated border border-dp-border rounded-sm flex flex-col gap-2 relative">
                <div className="absolute top-2 right-2 flex gap-1">
                  <button type="button" onClick={() => openEditBadge(b)} className="w-6 h-6 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Edit"><Pencil size={11} /></button>
                  <button type="button" onClick={() => deleteBadge(b)} className="w-6 h-6 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta" aria-label="Delete"><Trash2 size={11} /></button>
                </div>
                <div className="text-2xl">{b.icon}</div>
                <p className="font-display text-base text-dp-text-primary pr-14">{b.name}</p>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm self-start ${RARITY_COLOR[b.rarity] ?? RARITY_COLOR.common}`}>{b.rarity}</span>
                <p className="text-[11px] text-dp-text-tertiary">{b.description}</p>
                {b.trigger_action && <p className="text-[10px] font-mono text-dp-text-tertiary">trigger: {b.trigger_action}</p>}
                <div className="mt-1 pt-2 border-t border-dp-border/60">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Prize reward</p>
                  {b.prize_promo_code || b.prize_description ? (
                    <p className="text-[10px] text-dp-accent-gold font-semibold">
                      {b.prize_description || b.prize_promo_code}
                      {b.prize_promo_code ? <span className="block font-mono text-dp-text-secondary mt-0.5">Code: {b.prize_promo_code}</span> : null}
                    </p>
                  ) : (
                    <button type="button" onClick={() => openEditBadge(b)} className="text-[10px] text-dp-text-tertiary hover:text-dp-accent-cta underline">
                      Not set — click to add promo code
                    </button>
                  )}
                </div>
              </div>
            ))}
            {badges.length === 0 && <p className="col-span-4 text-center py-6 text-dp-text-tertiary">No badges configured.</p>}
          </div>
        )}
      </section>

      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">{editingRule ? "Edit XP Rule" : "New XP Rule"}</h2>
              <button type="button" onClick={() => setShowRuleModal(false)} className="text-dp-text-tertiary hover:text-dp-text-primary"><X size={18} /></button>
            </div>
            <form onSubmit={saveRule} className="p-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Action Key</span>
                <input required disabled={!!editingRule} value={ruleForm.action_key} onChange={(e) => setRuleForm((f) => ({ ...f, action_key: e.target.value }))} placeholder="first_purchase" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary disabled:opacity-60" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">XP Amount</span>
                <input required type="number" min="1" value={ruleForm.xp_amount} onChange={(e) => setRuleForm((f) => ({ ...f, xp_amount: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Description</span>
                <input value={ruleForm.description} onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-dp-text-secondary">
                <input type="checkbox" checked={ruleForm.is_one_time} onChange={(e) => setRuleForm((f) => ({ ...f, is_one_time: e.target.checked }))} />
                One-time only
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowRuleModal(false)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBadgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">{editingBadge ? "Edit Badge" : "New Badge"}</h2>
              <button type="button" onClick={() => setShowBadgeModal(false)} className="text-dp-text-tertiary hover:text-dp-text-primary"><X size={18} /></button>
            </div>
            <form onSubmit={saveBadge} className="p-5 flex flex-col gap-4">
              {badgeModalError && (
                <div className="px-3 py-2 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[12px] text-dp-accent-cta">
                  {badgeModalError}
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Name</span>
                <input required value={badgeForm.name} onChange={(e) => setBadgeForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Icon (emoji, max 10 chars)</span>
                <input required maxLength={10} value={badgeForm.icon} onChange={(e) => setBadgeForm((f) => ({ ...f, icon: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Rarity</span>
                <select value={badgeForm.rarity} onChange={(e) => setBadgeForm((f) => ({ ...f, rarity: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary">
                  <option value="common">Common</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Description</span>
                <textarea required value={badgeForm.description} onChange={(e) => setBadgeForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary resize-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Trigger Action Key</span>
                <input value={badgeForm.trigger_action} onChange={(e) => setBadgeForm((f) => ({ ...f, trigger_action: e.target.value }))} placeholder="first_purchase" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Prize Promo Code</span>
                <select value={badgeForm.prize_promo_id} onChange={(e) => setBadgeForm((f) => ({ ...f, prize_promo_id: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary">
                  <option value="">None</option>
                  {promos.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Prize Description</span>
                <input value={badgeForm.prize_description} onChange={(e) => setBadgeForm((f) => ({ ...f, prize_description: e.target.value }))} placeholder="Free shipping on next order" className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowBadgeModal(false)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
