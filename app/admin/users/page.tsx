"use client"

import React, { useEffect, useState } from "react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Search, Shield, ShieldOff } from "lucide-react"

type AdminUser = {
  id: string; email: string; name: string; role: string
  orders?: number; xp?: number; joined?: string; banned?: boolean
  date_joined?: string
}

export default function AdminUsersPage(): React.ReactElement {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = adminUser && !adminUser.is_staff && !!adminUser.vendor
  const endpoint = isVendor ? "/vendors/me/customers/" : "/admin/users/"
  const pageTitle = isVendor ? "Customers" : "All Users"
  const pageDesc = isVendor ? "Customers who have purchased your products." : "All registered platform users."

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

  const filtered = users.filter(
    (u) => !search || u.email.toLowerCase().includes(search.toLowerCase()) || (u.name ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">{pageTitle}</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">{pageDesc}</p>
      </div>

      <div className="relative w-full sm:w-72">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…"
          className="w-full pl-8 pr-4 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors" />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-dp-border">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Joined</th>
                {!isVendor && <th className="text-left px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-dp-border">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-dp-bg-elevated transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-dp-text-primary">{u.name || "—"}</p>
                    <p className="text-[11px] text-dp-text-tertiary">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-widest text-dp-text-secondary border-dp-border">
                      {u.role ?? "customer"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dp-text-tertiary">
                    {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : u.joined ?? "—"}
                  </td>
                  {!isVendor && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleBan(u.id, u.banned ?? false)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-sm border text-[11px] font-bold uppercase tracking-widest transition-colors ${
                          u.banned
                            ? "border-dp-success text-dp-success hover:bg-dp-success/10"
                            : "border-dp-accent-cta text-dp-accent-cta hover:bg-dp-accent-cta/10"
                        }`}
                        aria-label={u.banned ? "Unban user" : "Ban user"}
                      >
                        {u.banned ? <Shield size={11} /> : <ShieldOff size={11} />}
                        {u.banned ? "Unban" : "Ban"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No users found.</p>}
        </div>
      )}
    </div>
  )
}
