"use client"

import React, { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"
import InboxPanel from "@/components/messaging/InboxPanel"
import { MessageSquare } from "lucide-react"

function InboxInner() {
  const searchParams = useSearchParams()
  const openConvId = searchParams.get("conv")

  return (
    <SiteShell>
      <div className="border-b border-dp-border bg-dp-bg-surface">
        <div className="dp-container py-6 flex items-center gap-4">
          <MessageSquare size={22} className="text-dp-accent-cta" />
          <div>
            <h1 className="font-display text-4xl md:text-5xl text-dp-text-primary leading-none">Inbox</h1>
          </div>
        </div>
      </div>

      <div className="dp-container py-0">
        <InboxPanel initialConvId={openConvId} autoSelectFirst />
      </div>
    </SiteShell>
  )
}

export default function InboxPage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <InboxInner />
    </Suspense>
  )
}
