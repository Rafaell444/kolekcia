"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Shield, RefreshCw, Trash2, Volume2 } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Report = {
  id: number
  target_type: "auction" | "inbox"
  target_id: number
  reporter_email: string
  reported_user_id: string | null
  reported_user_email: string | null
  vendor_name: string | null
  auction_id: number | null
  auction_title: string | null
  reason: string
  status: string
  created_at: string
}

type Restriction = {
  id: number
  user_email: string
  vendor_name: string | null
  auction_title: string | null
  channel: string
  is_banned: boolean
  muted_until: string | null
  requires_admin_review: boolean
  strike_count: number
  reason: string
}

type RiskEvent = {
  id: number
  event_type: string
  outcome: string
  user_email: string | null
  auction_title: string | null
  vendor_name: string | null
  reason: string
  ip_hash: string
  device_hash: string
  created_at: string
}

export default function ChatSafetyPage() {
  const [tab, setTab] = useState<"reports" | "restrictions" | "risk">("reports")
  const [reports, setReports] = useState<Report[]>([])
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [events, setEvents] = useState<RiskEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reportData, restrictionData, eventData] = await Promise.all([
        adminFetch<Report[]>("/messaging/moderation/reports/"),
        adminFetch<Restriction[]>("/messaging/moderation/restrictions/"),
        adminFetch<RiskEvent[]>("/messaging/moderation/risk-events/"),
      ])
      setReports(reportData)
      setRestrictions(restrictionData)
      setEvents(eventData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function review(report: Report, status: "resolved" | "dismissed") {
    await adminFetch(`/messaging/moderation/reports/${report.id}/`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
    setNotice(`Report ${status}.`)
    await load()
  }

  async function removeMessage(report: Report) {
    const reason = window.prompt("Deletion reason", "Removed after user report.")
    if (!reason) return
    await adminFetch(`/messaging/moderation/messages/${report.target_type}/${report.target_id}/delete/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
    await review(report, "resolved")
  }

  async function restrict(report: Report, action: "30" | "300" | "review" | "ban") {
    if (!report.reported_user_id) return
    const reason = window.prompt("Moderation reason", report.reason)
    if (!reason) return
    await adminFetch("/messaging/moderation/restrictions/", {
      method: "POST",
      body: JSON.stringify({
        user_id: report.reported_user_id,
        channel: report.target_type === "auction" ? "auction" : "inbox",
        auction_id: report.target_type === "auction" ? report.auction_id : null,
        duration_seconds: action === "30" || action === "300" ? Number(action) : null,
        requires_admin_review: action === "review",
        is_banned: action === "ban",
        reason,
      }),
    })
    setNotice("Restriction applied and recorded.")
    await load()
  }

  async function unmute(item: Restriction) {
    await adminFetch(`/messaging/moderation/restrictions/${item.id}/`, { method: "DELETE" })
    setNotice("Restriction removed and recorded.")
    await load()
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Shield className="text-dp-accent-cta" size={24} />
        <div>
          <h1 className="font-display text-3xl text-dp-text-primary">Chat Safety</h1>
          <p className="text-[12px] text-dp-text-tertiary">Reports, scoped restrictions, and privacy-safe risk history.</p>
        </div>
        <button onClick={() => void load()} className="ml-auto p-2 border border-dp-border rounded-sm" aria-label="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {notice && <p className="mb-4 p-3 border border-green-500/30 bg-green-500/10 text-green-400 text-[12px]">{notice}</p>}

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {(["reports", "restrictions", "risk"] as const).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest border rounded-sm ${tab === item ? "border-dp-accent-cta text-dp-accent-cta" : "border-dp-border text-dp-text-secondary"}`}>
            {item === "risk" ? "Risk events" : item} {item === "reports" && `(${reports.filter((r) => r.status === "open").length})`}
          </button>
        ))}
      </div>

      {loading ? <p className="py-12 text-center text-dp-text-tertiary">Loading safety records...</p> : null}

      {!loading && tab === "reports" && (
        <div className="space-y-3">
          {reports.map((report) => (
            <article key={report.id} className="p-4 border border-dp-border bg-dp-bg-surface rounded-sm">
              <div className="flex flex-wrap gap-2 items-start">
                <div className="flex-1 min-w-[240px]">
                  <p className="text-[11px] uppercase tracking-widest text-dp-text-tertiary">{report.target_type} · {report.status}</p>
                  <p className="font-semibold text-dp-text-primary">{report.reported_user_email ?? "Unknown user"}</p>
                  <p className="text-[12px] text-dp-text-secondary mt-1">{report.reason}</p>
                  <p className="text-[10px] text-dp-text-tertiary mt-2">Reported by {report.reporter_email} · {new Date(report.created_at).toLocaleString()}</p>
                </div>
                {report.status === "open" && <div className="flex flex-wrap gap-1 justify-end">
                  <button onClick={() => void removeMessage(report)} className="px-2 py-1 border border-red-500/50 text-red-400 text-[10px] rounded-sm"><Trash2 size={11} className="inline mr-1" />Delete</button>
                  <button onClick={() => void restrict(report, "30")} className="px-2 py-1 border border-dp-border text-[10px] rounded-sm">Mute 30s</button>
                  <button onClick={() => void restrict(report, "300")} className="px-2 py-1 border border-dp-border text-[10px] rounded-sm">Mute 5m</button>
                  <button onClick={() => void restrict(report, "review")} className="px-2 py-1 border border-amber-500/50 text-amber-400 text-[10px] rounded-sm">Review hold</button>
                  <button onClick={() => void restrict(report, "ban")} className="px-2 py-1 border border-red-500/50 text-red-400 text-[10px] rounded-sm">Ban</button>
                  <button onClick={() => void review(report, "dismissed")} className="px-2 py-1 border border-dp-border text-[10px] rounded-sm">Dismiss</button>
                </div>}
              </div>
            </article>
          ))}
          {reports.length === 0 && <p className="py-12 text-center text-dp-text-tertiary">No reports.</p>}
        </div>
      )}

      {!loading && tab === "restrictions" && (
        <div className="space-y-3">
          {restrictions.map((item) => (
            <article key={item.id} className="p-4 border border-dp-border bg-dp-bg-surface rounded-sm flex flex-wrap gap-3 items-center">
              <Volume2 size={16} className="text-dp-accent-cta" />
              <div className="flex-1 min-w-[220px]">
                <p className="font-semibold text-dp-text-primary">{item.user_email}</p>
                <p className="text-[11px] text-dp-text-tertiary">{item.channel} · {item.auction_title ?? item.vendor_name ?? "platform"} · strikes {item.strike_count}</p>
                <p className="text-[11px] text-dp-text-secondary">{item.reason}</p>
              </div>
              <span className="text-[10px] uppercase text-amber-400">{item.is_banned ? "Banned" : item.requires_admin_review ? "Review hold" : item.muted_until ? `Muted until ${new Date(item.muted_until).toLocaleString()}` : "Restricted"}</span>
              <button onClick={() => void unmute(item)} className="px-3 py-1.5 border border-green-500/50 text-green-400 text-[10px] uppercase rounded-sm">Unmute</button>
            </article>
          ))}
        </div>
      )}

      {!loading && tab === "risk" && (
        <div className="overflow-x-auto border border-dp-border rounded-sm">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-dp-bg-elevated text-dp-text-tertiary uppercase tracking-wider"><th className="p-3 text-left">Event</th><th className="p-3 text-left">Account</th><th className="p-3 text-left">Scope</th><th className="p-3 text-left">Reason</th><th className="p-3 text-left">Signals</th><th className="p-3 text-left">Time</th></tr></thead>
            <tbody className="divide-y divide-dp-border">{events.map((event) => <tr key={event.id}><td className="p-3"><span className={event.outcome === "rejected" ? "text-red-400" : event.outcome === "admin" ? "text-amber-400" : "text-green-400"}>{event.event_type}</span></td><td className="p-3">{event.user_email ?? "Anonymous"}</td><td className="p-3">{event.auction_title ?? event.vendor_name ?? "Platform"}</td><td className="p-3 max-w-xs">{event.reason}</td><td className="p-3 font-mono text-[9px]">IP {event.ip_hash || "-"}<br />DEV {event.device_hash || "-"}</td><td className="p-3 whitespace-nowrap">{new Date(event.created_at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
