import { NextRequest, NextResponse } from "next/server"

/**
 * Next.js 16 proxy (formerly middleware).
 * API rewrites to Django are configured in next.config.mjs.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const categoryProductMatch = pathname.match(/^\/catalog\/([^/]+)\/([^/]+)\/?$/)
  if (categoryProductMatch) {
    const url = request.nextUrl.clone()
    url.pathname = `/catalog/${categoryProductMatch[2]}`
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}
