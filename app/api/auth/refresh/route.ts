import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const REFRESH_COOKIE = "kol_refresh"
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
const MAX_AGE_REMEMBER = 60 * 60 * 24 * 30

/**
 * Proxy JWT refresh using the httpOnly refresh cookie.
 * Returns { access, refresh? } so the client can keep access in memory.
 */
export async function POST(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value
  if (!refresh) {
    return NextResponse.json({ detail: "No refresh token" }, { status: 401 })
  }

  try {
    const upstream = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })

    if (!upstream.ok) {
      const res = NextResponse.json({ detail: "Refresh failed" }, { status: 401 })
      res.cookies.set(REFRESH_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      })
      return res
    }

    const data = (await upstream.json()) as { access: string; refresh?: string }
    const res = NextResponse.json({ access: data.access, refresh: data.refresh })

    if (data.refresh) {
      const hadMaxAge = Boolean(request.cookies.get(REFRESH_COOKIE))
      res.cookies.set(REFRESH_COOKIE, data.refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        ...(hadMaxAge ? { maxAge: MAX_AGE_REMEMBER } : {}),
      })
    }

    return res
  } catch {
    return NextResponse.json({ detail: "Refresh unavailable" }, { status: 503 })
  }
}
