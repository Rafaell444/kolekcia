"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminActivityAliasPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/logs")
  }, [router])

  return <div className="min-h-screen bg-dp-bg-base" />
}
