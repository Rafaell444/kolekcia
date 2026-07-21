"use client"

import React from "react"
import { useRequireAuth } from "@/hooks/useRequireAuth"

export default function AccountLayoutClient({ children }: { children: React.ReactNode }): React.ReactElement {
  const { loading } = useRequireAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="w-8 h-8 border-2 border-dp-border border-t-dp-accent-cta rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
