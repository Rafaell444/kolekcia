"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { Search, ChevronDown, ChevronRight, ScrollText } from "lucide-react"

type LogEntry = {
  id: number
  admin_email: string | null
  action: string
  target_type: string
  target_id: string
  detail: Record<string, unknown>
  summary: string
  category: string
  timestamp: string
}

const CATEGORIES = ["", "Order", "Payment", "Product", "Settings", "Content", "System"]

function categoryColor(cat: string): string {
  switch (cat) {
    case "Order": return "bg-blue-500/10 text-blue-400 border-blue-500/30"
    case "Payment": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    case "Product": return "bg-purple-500/10 text-purple-400 border-purple-500/30"
    case "Settings": return "bg-amber-500/10 text-amber-400 border-amber-500/30"
    case "Content": return "bg-pink-500/10 text-pink-400 border-pink-500/30"
    default: return "bg-dp-bg-elevated text-dp-text-tertiary border-dp-border"
  }
}

export default function AdminLogsPage(): React.ReactElement {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    const user = getAdminUser()
    if (!user?.is_staff) {
      router.replace("/admin")
    }
  }, [router])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set("category", category)
    if (search) params.set("search", search)
    if (dateFrom) params.set("date_from", dateFrom)
    if (dateTo) params.set("date_to", dateTo)
    const qs = params.toString()
    adminFetch<{ results?: LogEntry[] } | LogEntry[]>(`/admin/audit-log/${qs ? `?${qs}` : ""}`)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results ?? [])
        setLogs(list)
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [category, search, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Activity Log</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Full audit trail — orders, payments, settings, and content changes.</p>
      </div>

      <div className="sticky top-0 z-10 bg-dp-bg-base/95 backdrop-blur border border-dp-border rounded-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary">
            <option value="">All</option>
            {CATEGORIES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary" />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, email…"
              className="w-full pl-9 pr-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[12px] text-dp-text-primary" />
          </div>
        </div>
        <button type="button" onClick={load}
          className="px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-bold uppercase tracking-widest rounded-sm">
          Filter
        </button>
      </div>

      <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
        {loading ? (
          <div className="p-8 animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-dp-bg-elevated rounded-sm" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-dp-text-tertiary">
            <ScrollText size={36} className="opacity-30" />
            <p className="text-[13px]">No log entries match your filters.</p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-dp-border bg-dp-bg-elevated text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                <th className="px-4 py-3 text-left w-8" />
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    className={`border-b border-dp-border/60 hover:bg-dp-bg-elevated cursor-pointer transition-colors ${log.category === "Order" || log.category === "Payment" ? "bg-dp-accent-cta/[0.02]" : ""}`}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-dp-text-tertiary">
                      {expanded === log.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3 text-dp-text-tertiary whitespace-nowrap font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-dp-text-secondary">{log.admin_email ?? "System"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${categoryColor(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dp-text-primary">{log.summary}</td>
                  </tr>
                  {expanded === log.id && (
                    <tr className="border-b border-dp-border/60 bg-dp-bg-elevated/50">
                      <td colSpan={5} className="px-6 py-4">
                        <pre className="text-[11px] font-mono text-dp-text-secondary overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify({ action: log.action, target_type: log.target_type, target_id: log.target_id, detail: log.detail }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
