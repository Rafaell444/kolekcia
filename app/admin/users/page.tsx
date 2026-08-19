"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Coins, Filter, MessageSquare, Search, Shield, ShieldOff, X } from "lucide-react"

type AdminUser = {
  id: string; email: string; name: string; role: string
  orders?: number; orders_count?: number; spendable_points?: number; lifetime_points?: number; pending_points?: number
  tier_key?: string; tier_name?: string; joined?: string; banned?: boolean
  date_joined?: string
}

export default function AdminUsersPage(): React.ReactElement {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [tierFilter, setTierFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [pointsFilter, setPointsFilter] = useState("all")
  const [messagingId, setMessagingId] = useState<string | null>(null)
  const [adjustingUser, setAdjustingUser] = useState<AdminUser | null>(null)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustReason, setAdjustReason] = useState("")
  const [adjustError, setAdjustError] = useState("")
  const [adjustSaving, setAdjustSaving] = useState(false)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = adminUser && !adminUser.is_staff && !!adminUser.vendor
  const endpoint = isVendor ? "/vendors/me/customers/" : "/admin/users/"
  const pageTitle = isVendor ? "Customers" : "All Users"
  const pageDesc = isVendor ? "Customers who have purchased or requested custom work." : "All registered platform users."

  useEffect(() => {
    let cancelled = false
    adminFetch<AdminUser[]>(endpoint)
      .then((d) => { if (!cancelled) setUsers(Array.isArray(d) ? d : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [endpoint])

  async function toggleBan(userId: string, currentBanned: boolean) {
    if (isVendor) return
    await adminFetch(`/admin/users/${userId}/toggle/`, { method: "POST" }).catch(() => {})
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned: !currentBanned } : u))
  }

  async function startInbox(customerId: string, customerName: string) {
    setMessagingId(customerId)
    try {
      const conv = await adminFetch<{ id: string | number }>("/messaging/conversations/start-with-customer/", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          subject: `Message to ${customerName}`,
        }),
      })
      router.push(`/admin/inbox?c=${conv.id}`)
    } catch {
      alert("Could not start conversation.")
    } finally {
      setMessagingId(null)
    }
  }

  function openAdjust(user: AdminUser) {
    setAdjustingUser(user)
    setAdjustAmount("")
    setAdjustReason("")
    setAdjustError("")
  }

  async function savePointAdjustment() {
    if (!adjustingUser || isVendor) return
    setAdjustSaving(true)
    setAdjustError("")
    try {
      const result = await adminFetch<Partial<AdminUser>>(`/admin/users/${adjustingUser.id}/points-adjustment/`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(adjustAmount),
          reason: adjustReason,
        }),
      })
      setUsers((prev) => prev.map((u) => (
        u.id === adjustingUser.id
          ? {
            ...u,
            spendable_points: result.spendable_points ?? u.spendable_points,
            pending_points: result.pending_points ?? u.pending_points,
            tier_key: result.tier_key ?? u.tier_key,
            tier_name: result.tier_name ?? u.tier_name,
          }
          : u
      )))
      setAdjustingUser(null)
    } catch (err) {
      const data = err && typeof err === "object" ? (err as { data?: { detail?: string } }).data : undefined
      setAdjustError(data?.detail || "Could not adjust points.")
    } finally {
      setAdjustSaving(false)
    }
  }

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q)
    const matchesRole = roleFilter === "all" || (u.role ?? "customer") === roleFilter
    const matchesTier = tierFilter === "all" || (u.tier_key ?? "genin") === tierFilter
    const matchesStatus =
      statusFilter === "all"
      || (statusFilter === "active" && u.banned !== true)
      || (statusFilter === "banned" && u.banned === true)
    const spendable = u.spendable_points ?? 0
    const pending = u.pending_points ?? 0
    const matchesPoints =
      pointsFilter === "all"
      || (pointsFilter === "spendable" && spendable > 0)
      || (pointsFilter === "pending" && pending > 0)
      || (pointsFilter === "zero" && spendable === 0 && pending === 0)
    return matchesSearch && (isVendor || (matchesRole && matchesTier && matchesStatus && matchesPoints))
  })

  const hasFilters = Boolean(search || roleFilter !== "all" || tierFilter !== "all" || statusFilter !== "all" || pointsFilter !== "all")

  function clearFilters() {
    setSearch("")
    setRoleFilter("all")
    setTierFilter("all")
    setStatusFilter("all")
    setPointsFilter("all")
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">{pageTitle}</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">{pageDesc}</p>
      </div>

      <div className="rounded-sm border border-dp-border bg-dp-bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-dp-text-tertiary">
            <Filter size={13} /> Filters
          </p>
          <p className="text-[12px] text-dp-text-tertiary">{filtered.length} of {users.length} shown</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
              className="w-full pl-8 pr-4 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
          </div>
          {!isVendor && (
            <>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary">
                <option value="all">All roles</option>
                <option value="customer">Customers</option>
                <option value="artist">Artists</option>
                <option value="staff">Staff</option>
              </select>
              <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary">
                <option value="all">All levels</option>
                <option value="genin">Genin</option>
                <option value="chunin">Chunin</option>
                <option value="jonin">Jonin</option>
              </select>
              <select value={pointsFilter} onChange={(e) => setPointsFilter(e.target.value)} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary">
                <option value="all">All points</option>
                <option value="spendable">Has spendable</option>
                <option value="pending">Has pending</option>
                <option value="zero">Zero points</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
              </select>
            </>
          )}
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-dp-accent-cta">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-dp-border">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                <th className="text-left px-4 py-3">User</th>
                {isVendor && <th className="text-left px-4 py-3">Orders</th>}
                {!isVendor && <th className="text-left px-4 py-3">Role</th>}
                {!isVendor && <th className="text-left px-4 py-3">Loyalty</th>}
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dp-border">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-dp-bg-elevated transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-dp-text-primary">{u.name || "—"}</p>
                    <p className="text-[11px] text-dp-text-tertiary">{u.email}</p>
                  </td>
                  {isVendor && (
                    <td className="px-4 py-3 text-dp-text-secondary">{u.orders_count ?? 0}</td>
                  )}
                  {!isVendor && (
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-widest text-dp-text-secondary border-dp-border">
                        {u.role ?? "customer"}
                      </span>
                    </td>
                  )}
                  {!isVendor && (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="font-black text-dp-text-primary">{u.spendable_points ?? 0} spendable</span>
                        <span className="text-dp-text-tertiary">{u.pending_points ?? 0} pending</span>
                        <span className="inline-flex w-fit rounded-sm border border-dp-accent-gold/40 px-2 py-0.5 font-black uppercase tracking-widest text-dp-accent-gold">
                          {u.tier_name || "Genin"}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-dp-text-tertiary">
                    {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : u.joined ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void startInbox(u.id, u.name || u.email)}
                        disabled={messagingId === u.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-sm border border-dp-border text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors disabled:opacity-50"
                      >
                        <MessageSquare size={11} /> Message
                      </button>
                      {!isVendor && (
                        <>
                        <button
                          type="button"
                          onClick={() => openAdjust(u)}
                          className="flex items-center gap-1 px-2 py-1 rounded-sm border border-dp-accent-gold/40 text-[11px] font-bold uppercase tracking-widest text-dp-accent-gold hover:bg-dp-accent-gold/10 transition-colors"
                        >
                          <Coins size={11} /> Points
                        </button>
                        <button
                          onClick={() => toggleBan(u.id, u.banned ?? false)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-sm border text-[11px] font-bold uppercase tracking-widest transition-colors ${
                            u.banned
                              ? "border-dp-success text-dp-success hover:bg-dp-success/10"
                              : "border-dp-accent-cta text-dp-accent-cta hover:bg-dp-accent-cta/10"
                          }`}
                        >
                          {u.banned ? <Shield size={11} /> : <ShieldOff size={11} />}
                          {u.banned ? "Unban" : "Ban"}
                        </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No users found.</p>}
        </div>
      )}
      {adjustingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-sm border border-dp-border bg-dp-bg-surface p-5 shadow-2xl">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-dp-accent-gold">Secure points adjustment</p>
              <h2 className="font-display text-2xl text-dp-text-primary mt-1">{adjustingUser.name || adjustingUser.email}</h2>
              <p className="text-[12px] text-dp-text-tertiary mt-1">
                Current balance: {adjustingUser.spendable_points ?? 0} spendable · {adjustingUser.pending_points ?? 0} pending · {adjustingUser.tier_name || "Genin"}
              </p>
            </div>
            {adjustError && <div className="mb-3 rounded-sm border border-dp-accent-cta/30 bg-dp-accent-cta/10 px-3 py-2 text-[12px] text-dp-accent-cta">{adjustError}</div>}
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Amount</span>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Example: 50 or -25"
                className="rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[13px] text-dp-text-primary"
              />
              <span className="text-[11px] text-dp-text-tertiary">Use positive numbers to add points and negative numbers to reduce points.</span>
            </label>
            <label className="mt-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Reason</span>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
                placeholder="Required for audit log"
                className="resize-none rounded-sm border border-dp-border bg-dp-bg-elevated px-3 py-2 text-[13px] text-dp-text-primary"
              />
            </label>
            <p className="mt-3 text-[11px] leading-relaxed text-dp-text-tertiary">
              This creates an immutable points ledger entry and admin audit log. Manual reductions cannot make the spendable balance negative.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAdjustingUser(null)} className="rounded-sm border border-dp-border px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-dp-text-secondary">
                Cancel
              </button>
              <button type="button" disabled={adjustSaving} onClick={() => void savePointAdjustment()} className="rounded-sm bg-dp-accent-cta px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-60">
                {adjustSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
