"use client"

import React from "react"
import SiteShell from "@/components/layout/SiteShell"
import Link from "next/link"
import { Bell, ChevronLeft } from "lucide-react"

export default function NotificationsPage(): React.ReactElement {
  return (
    <SiteShell>
      <div className="bg-dp-bg-surface border-b border-dp-border">
        <div className="dp-container py-6 md:py-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-1 text-[12px] text-dp-text-tertiary hover:text-dp-text-primary transition-colors mb-4"
          >
            <ChevronLeft size={14} /> Back to profile
          </Link>
          <div className="flex items-center gap-3">
            <Bell size={22} className="text-dp-accent-cta" />
            <h1 className="font-display text-2xl sm:text-3xl text-dp-text-primary">Notifications</h1>
          </div>
        </div>
      </div>

      <div className="dp-container py-12">
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-dp-bg-surface border border-dp-border rounded-sm">
          <Bell size={40} className="text-dp-text-tertiary opacity-30 mb-4" />
          <p className="font-display text-2xl text-dp-text-primary mb-2">No notifications yet</p>
          <p className="text-[13px] text-dp-text-tertiary max-w-sm">
            Order updates, auction alerts, and messages will appear here.
          </p>
        </div>
      </div>
    </SiteShell>
  )
}
