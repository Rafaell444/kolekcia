import type { Metadata } from "next"
import { LOCALES, type Locale } from "@/lib/i18n"
import { TERMS_SEO } from "@/lib/seo-metadata"
import SiteShell from "@/components/layout/SiteShell"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = TERMS_SEO[(locale as Locale) ?? "en"] ?? TERMS_SEO.en
  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) alternates[loc] = `${SITE_URL}/${loc}/terms`
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `${SITE_URL}/${locale}/terms`, languages: alternates },
  }
}

export default function TermsPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Terms of Service</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
          <p>By using Kolekcia you agree to these terms. Please read them carefully.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Accounts</h2>
          <p>You are responsible for maintaining the security of your account and for all activity under it.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Purchases</h2>
          <p>All prices are shown in your selected currency. Final charges are processed at checkout. Auction bids are binding.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Intellectual Property</h2>
          <p>Artwork remains the property of respective artists. Purchases grant personal display rights only.</p>
        </div>
      </div>
    </SiteShell>
  )
}
