import type { Metadata } from "next"
import { LOCALES, type Locale } from "@/lib/i18n"
import { PRIVACY_SEO } from "@/lib/seo-metadata"
import SiteShell from "@/components/layout/SiteShell"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = PRIVACY_SEO[(locale as Locale) ?? "en"] ?? PRIVACY_SEO.en
  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) alternates[loc] = `${SITE_URL}/${loc}/privacy`
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `${SITE_URL}/${locale}/privacy`, languages: alternates },
  }
}

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Privacy Policy</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="prose prose-sm text-dp-text-secondary space-y-4 text-[14px] leading-relaxed">
          <p>Kolekcia respects your privacy. This policy explains what data we collect, how we use it, and your rights.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Information We Collect</h2>
          <p>We collect account information (name, email), order and shipping details, payment references, and usage data to operate the marketplace.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">How We Use Data</h2>
          <p>We use your data to process orders, provide customer support, improve our services, and send updates you opt into.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Your Rights</h2>
          <p>You may request access, correction, or deletion of your personal data by contacting us at support@kolekcia.com.</p>
        </div>
      </div>
    </SiteShell>
  )
}
