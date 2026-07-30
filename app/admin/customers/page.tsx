"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminCustomersAliasPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/users")
  }, [router])

  return <div className="min-h-screen bg-dp-bg-base" />
}
