import { authFetch } from "@/lib/api"

export const REF_STORAGE_KEY = "pending_referral_code"

export function captureReferralFromUrl(search?: string) {
  if (typeof window === "undefined") return
  const params = new URLSearchParams(search ?? window.location.search)
  const ref = (params.get("ref") || "").trim().toUpperCase()
  if (!ref) return
  localStorage.setItem(REF_STORAGE_KEY, ref)
  sessionStorage.setItem(REF_STORAGE_KEY, ref)
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(REF_STORAGE_KEY) || sessionStorage.getItem(REF_STORAGE_KEY)
}

export function withReferralQuery(href: string): string {
  const code = getPendingReferralCode()
  if (!code) return href
  const sep = href.includes("?") ? "&" : "?"
  return `${href}${sep}ref=${encodeURIComponent(code)}`
}

export async function claimPendingReferral(): Promise<boolean> {
  const code = getPendingReferralCode()
  if (!code) return false
  try {
    await authFetch("/referrals/claim/", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
    localStorage.removeItem(REF_STORAGE_KEY)
    sessionStorage.removeItem(REF_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
