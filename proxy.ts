import { NextRequest, NextResponse } from "next/server"

/**
 * Next.js 16 proxy (formerly middleware).
 * API rewrites to Django are configured in next.config.mjs.
 */
export function proxy(_request: NextRequest): NextResponse {
  return NextResponse.next()
}
