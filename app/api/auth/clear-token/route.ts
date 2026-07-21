import { NextResponse } from "next/server"

const REFRESH_COOKIE = "kol_refresh"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return res
}
