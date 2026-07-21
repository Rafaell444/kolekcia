import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const REFRESH_COOKIE = "kol_refresh"
const MAX_AGE_REMEMBER = 60 * 60 * 24 * 30 // 30 days

export async function POST(request: NextRequest) {
  let body: { refresh?: string; rememberMe?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 })
  }

  const refresh = typeof body.refresh === "string" ? body.refresh.trim() : ""
  if (!refresh) {
    return NextResponse.json({ detail: "refresh is required" }, { status: 400 })
  }

  const rememberMe = Boolean(body.rememberMe)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(REFRESH_COOKIE, refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(rememberMe ? { maxAge: MAX_AGE_REMEMBER } : {}),
  })
  return res
}
