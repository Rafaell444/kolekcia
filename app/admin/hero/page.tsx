"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminHeroRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/admin/pages?tab=home&section=hero") }, [router])
  return null
}
