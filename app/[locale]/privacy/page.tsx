import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { PRIVACY_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import SiteShell from "@/components/layout/SiteShell"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = PRIVACY_SEO[(locale as Locale) ?? "en"] ?? PRIVACY_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/privacy",
    locale,
  })
}

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Privacy Policy</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="prose prose-sm text-dp-text-secondary space-y-4 text-[14px] leading-relaxed">
          <p>Koleqcia respects your privacy. This policy explains what data we collect, how we use it, and your rights.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Information We Collect</h2>
          <p>We collect account information (name, email), order and shipping details, payment references, and usage data to operate the marketplace.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">How We Use Data</h2>
          <p>We use your data to process orders, provide customer support, improve our services, and send updates you opt into.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Your Rights</h2>
          <p>You may request access, correction, or deletion of your personal data by contacting us at support@Koleqcia.com.</p>
        </div>
      </div>
    </SiteShell>
  )
}
