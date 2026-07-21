import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { Barlow, Barlow_Condensed, Bebas_Neue, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/contexts/auth-context'
import GoogleAuthProvider from '@/components/auth/GoogleAuthProvider'
import { GamificationProvider } from '@/contexts/gamification-context'
import { CartProvider } from '@/contexts/cart-context'
import { WishlistProvider } from '@/contexts/wishlist-context'
import { LocaleProvider } from '@/contexts/locale-context'
import ReferralTracker from '@/components/referrals/ReferralTracker'
import './globals.css'

/**
 * KOLEQCIA DESIGN SYSTEM — Font Loading
 *
 * Display / Headings:  Bebas Neue  (condensed, all-caps impact)
 * Body / UI:           Barlow      (humanist sans, highly legible)
 * Condensed UI:        Barlow Condensed (card titles, price displays)
 * Mono:                Geist Mono  (code, admin panels)
 */
const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas-neue',
  display: 'swap',
})

const barlow = Barlow({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Unique Gifts, Anime & Gaming Decor Made in Georgia | Koleqcia',
    template: '%s | Koleqcia',
  },
  description:
    'Discover handmade anime, gaming, and movie decor. Shop unique gifts, wall art, and figures. Proudly made in Georgia. Find the perfect gift today!',
  keywords: [
    'anime figures',
    'gaming decor',
    'handmade gifts',
    'wooden wall art',
    'unique gifts Georgia',
    'Koleqcia',
  ],
  authors: [{ name: 'Koleqcia' }],
  creator: 'Koleqcia',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://koleqcia.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Koleqcia',
    images: [{ url: '/images/og-koleqcia.jpg', width: 1200, height: 630, alt: 'Koleqcia' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/og-koleqcia.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f5' },
    { media: '(prefers-color-scheme: dark)',  color: '#111113' },
  ],
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers()
  const locale = headersList.get("x-locale") || "en"

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`
        light
        ${bebasNeue.variable}
        ${barlow.variable}
        ${barlowCondensed.variable}
        ${geistMono.variable}
        bg-background
      `}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
          <LocaleProvider>
            <GoogleAuthProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <GamificationProvider>
                    <Suspense fallback={null}>
                      <ReferralTracker />
                    </Suspense>
                    {children}
                  </GamificationProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
            </GoogleAuthProvider>
          </LocaleProvider>
      </body>
    </html>
  )
}
