import type { Metadata } from "next"
import { LOCALES, type Locale } from "@/lib/i18n"
import { COOKIES_SEO } from "@/lib/seo-metadata"
import SiteShell from "@/components/layout/SiteShell"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = COOKIES_SEO[(locale as Locale) ?? "en"] ?? COOKIES_SEO.en
  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) alternates[loc] = `${SITE_URL}/${loc}/cookies`
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `${SITE_URL}/${locale}/cookies`, languages: alternates },
  }
}

export default function CookiesPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Cookie Policy</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
          <p>Kolekcia uses cookies and similar technologies to keep you signed in, remember preferences, and analyze site usage.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Essential Cookies</h2>
          <p>Required for authentication, cart, and checkout. These cannot be disabled.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Preference Cookies</h2>
          <p>Store your language and currency selections for a better experience.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Managing Cookies</h2>
          <p>You can control cookies through your browser settings. Disabling essential cookies may limit site functionality.</p>
        </div>
      </div>
    </SiteShell>
  )
}
