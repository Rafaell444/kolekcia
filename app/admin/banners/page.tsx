"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminBannersRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/admin/pages?tab=home&section=promo") }, [router])
  return null
}
