"use client"

import { useEffect, useState } from "react"
import { authFetch, parseList, type PaginatedResponse } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-storage"
import { adminFetch, getAdminToken } from "@/lib/admin-auth"

type InboxUnreadRow = { unread_count?: number }

function sumUnread(rows: InboxUnreadRow[]) {
  return rows.reduce((s, c) => s + (c.unread_count ?? 0), 0)
}

export function useInboxUnreadCount(pollMs = 10000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!getAccessToken()) {
        if (!cancelled) setCount(0)
        return
      }
      try {
        const raw = await authFetch<InboxUnreadRow[] | PaginatedResponse<InboxUnreadRow>>("/messaging/conversations/")
        if (!cancelled) setCount(sumUnread(parseList(raw)))
      } catch {
        if (!cancelled) setCount(0)
      }
    }

    load()
    const onRead = () => { void load() }
    window.addEventListener("inbox-read", onRead)
    const id = setInterval(load, pollMs)
    return () => { cancelled = true; clearInterval(id); window.removeEventListener("inbox-read", onRead) }
  }, [pollMs])

  return count
}

export function useAdminInboxUnreadCount(pollMs = 10000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!getAdminToken()) {
        if (!cancelled) setCount(0)
        return
      }
      try {
        const raw = await adminFetch<InboxUnreadRow[] | PaginatedResponse<InboxUnreadRow>>("/messaging/conversations/")
        if (!cancelled) setCount(sumUnread(parseList(raw)))
      } catch {
        if (!cancelled) setCount(0)
      }
    }

    load()
    const onRead = () => { void load() }
    window.addEventListener("inbox-read", onRead)
    const id = setInterval(load, pollMs)
    return () => { cancelled = true; clearInterval(id); window.removeEventListener("inbox-read", onRead) }
  }, [pollMs])

  return count
}
