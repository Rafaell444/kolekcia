import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isProd = process.env.NODE_ENV === "production"
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

/** Build a pragmatic CSP that allows Google Fonts/Auth, images CDN, and the API. */
function buildContentSecurityPolicy() {
  const connectSrc = [
    "'self'",
    "https:",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "ws://127.0.0.1:8000",
    "ws://localhost:8000",
    "wss:",
  ]
  try {
    const u = new URL(apiUrl)
    connectSrc.push(`${u.protocol}//${u.host}`)
  } catch {
    // ignore invalid API URL
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: http://127.0.0.1:8000 http://localhost:8000",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https://accounts.google.com",
    "media-src 'self' data: blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["127.0.0.1"],
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  images: {
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "http",  hostname: "127.0.0.1", port: "8000" },
      { protocol: "http",  hostname: "localhost",  port: "8000" },
      { protocol: "https", hostname: "*.vercel.app" },
      { protocol: "https", hostname: "*.pythonanywhere.com" },
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
    ]

    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      })
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  async rewrites() {
    // afterFiles: App Router handlers (e.g. /api/auth/*) take precedence.
    // Exclude /api/auth/* so httpOnly cookie routes are never proxied to Django.
    return {
      afterFiles: [
        {
          source: "/api/:path((?!auth/).*)",
          destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"}/:path*`,
        },
      ],
    }
  },
}

export default nextConfig
