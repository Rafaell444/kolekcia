"use client"

import React, { useEffect, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import {
  Plus, Save, Trash2, ArrowLeft, Mail, Eye, EyeOff, Clock,
  Copy, ChevronDown, Sparkles,
} from "lucide-react"

const EmailEditor = dynamic(() => import("@/components/admin/EmailEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 text-dp-text-tertiary">
      Loading editor...
    </div>
  ),
})

type EmailTemplate = {
  id: number
  vendor: number | null
  vendor_name: string
  event_key: string
  name: string
  subject: string
  html_body: string
  design_json: Record<string, unknown>
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

type EmailLog = {
  id: number
  template_name: string
  recipient_email: string
  subject: string
  event_key: string
  status: string
  error_message: string
  sent_at: string
}

const EVENT_OPTIONS = [
  { value: "order_confirmed", label: "Order Confirmed" },
  { value: "order_shipped", label: "Order Shipped" },
  { value: "custom_order_shipped", label: "Custom Order Shipped" },
  { value: "auction_new", label: "New Auction Notification" },
  { value: "auction_won", label: "Auction Won" },
  { value: "password_reset", label: "Password Reset" },
  { value: "welcome", label: "Welcome / Registration" },
  { value: "custom", label: "Custom / One-off" },
]

const EVENT_VARIABLES: Record<string, string[]> = {
  order_confirmed: ["customer_name", "order_number", "total", "currency", "items"],
  order_shipped: ["customer_name", "order_number", "tracking_code", "tracking_info"],
  custom_order_shipped: ["customer_name", "tracking_code", "payment_link"],
  auction_new: ["auction_title", "starting_bid", "starts_at", "image_url", "auction_url"],
  auction_won: ["winner_name", "auction_title", "winning_amount", "payment_link"],
  password_reset: ["reset_url", "user_name"],
  welcome: ["user_name"],
  custom: [],
}

const EMPTY_FORM = {
  name: "",
  event_key: "custom",
  subject: "",
  html_body: "",
  design_json: {} as Record<string, unknown>,
  variables: [] as string[],
  is_active: true,
  vendor: null as number | null,
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"templates" | "logs">("templates")
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showVars, setShowVars] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState("")

  const adminUser = getAdminUser()
  const isSuperadmin = adminUser?.is_staff ?? false

  const loadTemplates = useCallback(async () => {
    try {
      const data = await adminFetch<EmailTemplate[]>("/admin/email-templates/")
      setTemplates(Array.isArray(data) ? data : [])
    } catch { /* noop */ }
  }, [])

  const loadLogs = useCallback(async () => {
    if (!isSuperadmin) return
    try {
      const data = await adminFetch<EmailLog[]>("/admin/email-logs/")
      setLogs(Array.isArray(data) ? data : [])
    } catch { /* noop */ }
  }, [isSuperadmin])

  useEffect(() => {
    Promise.all([loadTemplates(), loadLogs()])
      .finally(() => setLoading(false))
  }, [loadTemplates, loadLogs])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setCreating(true)
  }

  async function openEdit(tpl: EmailTemplate) {
    try {
      const full = await adminFetch<EmailTemplate>(`/admin/email-templates/${tpl.id}/`)
      setForm({
        name: full.name,
        event_key: full.event_key,
        subject: full.subject,
        html_body: full.html_body,
        design_json: full.design_json || {},
        variables: full.variables || [],
        is_active: full.is_active,
        vendor: full.vendor,
      })
      setEditing(full)
      setCreating(true)
    } catch { /* noop */ }
  }

  function handleEditorChange(data: { html: string; design: Record<string, unknown> }) {
    setForm((prev) => ({ ...prev, html_body: data.html, design_json: data.design }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        variables: EVENT_VARIABLES[form.event_key] || [],
      }

      if (editing) {
        await adminFetch(`/admin/email-templates/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        await adminFetch("/admin/email-templates/", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      await loadTemplates()
      setCreating(false)
      setEditing(null)
    } catch { /* noop */ }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this template?")) return
    try {
      await adminFetch(`/admin/email-templates/${id}/`, { method: "DELETE" })
      await loadTemplates()
      if (editing?.id === id) {
        setCreating(false)
        setEditing(null)
      }
    } catch { /* noop */ }
  }

  async function handleInstallDefaults(overwrite = false) {
    if (!isSuperadmin) return
    const msg = overwrite
      ? "Replace all platform email templates with the branded Koleqcia designs?"
      : "Install branded Koleqcia email templates for any missing event types?"
    if (!confirm(msg)) return
    setSeeding(true)
    setSeedMsg("")
    try {
      const result = await adminFetch<{ created: number; updated: number; skipped: number }>(
        "/admin/email-templates/seed/",
        { method: "POST", body: JSON.stringify({ overwrite }) },
      )
      await loadTemplates()
      setSeedMsg(
        `Installed — created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`,
      )
    } catch {
      setSeedMsg("Could not install templates. Check you are logged in as superadmin.")
    }
    setSeeding(false)
  }

  function copyVariable(v: string) {
    navigator.clipboard.writeText(`{{${v}}}`)
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-dp-text-tertiary">Loading...</div>
      </div>
    )
  }

  if (creating) {
    const availableVars = EVENT_VARIABLES[form.event_key] || []

    return (
      <div className="p-6 md:p-10 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setCreating(false); setEditing(null) }}
            className="p-2 rounded-md hover:bg-dp-bg-elevated text-dp-text-secondary transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-display text-dp-text-primary">
            {editing ? "Edit Template" : "New Template"}
          </h1>
        </div>

        {/* Settings bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-xs font-medium text-dp-text-secondary mb-1 block">Template Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md bg-dp-bg-elevated border border-dp-border text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:ring-1 focus:ring-dp-accent-cta"
              placeholder="e.g. Order Confirmation"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-dp-text-secondary mb-1 block">Event Trigger</label>
            <div className="relative">
              <select
                value={form.event_key}
                onChange={(e) => setForm((p) => ({ ...p, event_key: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-md bg-dp-bg-elevated border border-dp-border text-dp-text-primary focus:outline-none focus:ring-1 focus:ring-dp-accent-cta appearance-none"
              >
                {EVENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dp-text-tertiary pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-dp-text-secondary mb-1 block">Email Subject</label>
            <input
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md bg-dp-bg-elevated border border-dp-border text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:ring-1 focus:ring-dp-accent-cta"
              placeholder="Your order #{{order_number}} is confirmed!"
            />
          </div>
        </div>

        {/* Variables helper */}
        {availableVars.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowVars(!showVars)}
              className="flex items-center gap-1.5 text-xs font-medium text-dp-accent-cta hover:underline"
            >
              <Copy size={12} />
              {showVars ? "Hide" : "Show"} available variables ({availableVars.length})
            </button>
            {showVars && (
              <div className="mt-2 flex flex-wrap gap-2">
                {availableVars.map((v) => (
                  <button
                    key={v}
                    onClick={() => copyVariable(v)}
                    className="px-2.5 py-1 text-xs bg-dp-bg-elevated border border-dp-border rounded-md text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-accent-cta transition-colors font-mono"
                    title="Click to copy"
                  >
                    {"{{" + v + "}}"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active toggle */}
        <div className="flex items-center gap-3 mb-5">
          <label className="flex items-center gap-2 text-sm text-dp-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              className="rounded border-dp-border"
            />
            Active
          </label>
        </div>

        {/* GrapesJS Editor */}
        <EmailEditor
          key={editing?.id ?? "new"}
          designJson={form.design_json}
          onChange={handleEditorChange}
        />

        {/* Save bar */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.subject}
            className="flex items-center gap-2 px-5 py-2.5 bg-dp-accent-cta text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Template"}
          </button>
          <button
            onClick={() => { setCreating(false); setEditing(null) }}
            className="px-4 py-2.5 text-sm text-dp-text-secondary hover:text-dp-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-dp-text-primary mb-1">Email Templates</h1>
          <p className="text-sm text-dp-text-tertiary">Design and manage transactional email templates</p>
          {seedMsg && <p className="text-xs text-dp-success mt-2">{seedMsg}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperadmin && (
            <>
              <button
                onClick={() => handleInstallDefaults(false)}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2.5 border border-dp-border text-dp-text-primary text-sm font-semibold rounded-md hover:border-dp-accent-cta hover:text-dp-accent-cta disabled:opacity-40 transition-colors"
              >
                <Sparkles size={14} />
                {seeding ? "Installing..." : "Install brand templates"}
              </button>
              {templates.length > 0 && (
                <button
                  onClick={() => handleInstallDefaults(true)}
                  disabled={seeding}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-dp-text-tertiary hover:text-dp-accent-cta disabled:opacity-40 transition-colors"
                  title="Overwrite existing platform templates"
                >
                  Reset to brand defaults
                </button>
              )}
            </>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Template
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-dp-border">
        <button
          onClick={() => setTab("templates")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "templates"
              ? "border-dp-accent-cta text-dp-text-primary"
              : "border-transparent text-dp-text-tertiary hover:text-dp-text-secondary"
          }`}
        >
          <span className="flex items-center gap-2"><Mail size={14} />Templates ({templates.length})</span>
        </button>
        {isSuperadmin && (
          <button
            onClick={() => { setTab("logs"); loadLogs() }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === "logs"
                ? "border-dp-accent-cta text-dp-text-primary"
                : "border-transparent text-dp-text-tertiary hover:text-dp-text-secondary"
            }`}
          >
            <span className="flex items-center gap-2"><Clock size={14} />Send Log</span>
          </button>
        )}
      </div>

      {/* Templates list */}
      {tab === "templates" && (
        <div className="space-y-2">
          {templates.length === 0 && (
            <div className="text-center py-16 text-dp-text-tertiary border border-dashed border-dp-border rounded-lg">
              <Mail size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-4">No email templates yet.</p>
              {isSuperadmin && (
                <button
                  onClick={() => handleInstallDefaults(false)}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta text-white text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-40"
                >
                  <Sparkles size={14} />
                  {seeding ? "Installing..." : "Install 8 branded templates"}
                </button>
              )}
            </div>
          )}
          {templates.map((tpl) => {
            const eventLabel = EVENT_OPTIONS.find((e) => e.value === tpl.event_key)?.label ?? tpl.event_key
            return (
              <div
                key={tpl.id}
                className="flex items-center justify-between p-4 bg-dp-bg-surface border border-dp-border rounded-lg hover:border-dp-border-hover transition-colors group"
              >
                <button onClick={() => openEdit(tpl)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Mail size={16} className="text-dp-accent-cta shrink-0" />
                    <span className="text-sm font-semibold text-dp-text-primary truncate">{tpl.name}</span>
                    {!tpl.is_active && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-dp-text-tertiary bg-dp-bg-elevated px-2 py-0.5 rounded-full">
                        <EyeOff size={10} />Inactive
                      </span>
                    )}
                    {tpl.is_active && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                        <Eye size={10} />Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-dp-text-tertiary">
                    <span className="bg-dp-bg-elevated px-2 py-0.5 rounded">{eventLabel}</span>
                    <span>{tpl.vendor_name}</span>
                    <span>Subject: {tpl.subject}</span>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(tpl.id)}
                  className="p-2 text-dp-text-tertiary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Logs list */}
      {tab === "logs" && isSuperadmin && (
        <div className="overflow-x-auto">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-dp-text-tertiary">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No emails sent yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dp-border text-left text-xs text-dp-text-tertiary uppercase tracking-wider">
                  <th className="pb-3 pr-4">Recipient</th>
                  <th className="pb-3 pr-4">Subject</th>
                  <th className="pb-3 pr-4">Event</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Sent</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-dp-border/50 hover:bg-dp-bg-elevated/50">
                    <td className="py-3 pr-4 text-dp-text-primary">{log.recipient_email}</td>
                    <td className="py-3 pr-4 text-dp-text-secondary truncate max-w-[200px]">{log.subject}</td>
                    <td className="py-3 pr-4">
                      <span className="text-xs bg-dp-bg-elevated px-2 py-0.5 rounded text-dp-text-secondary">
                        {log.event_key}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-medium ${log.status === "sent" ? "text-green-500" : "text-red-500"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 text-dp-text-tertiary text-xs">
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
