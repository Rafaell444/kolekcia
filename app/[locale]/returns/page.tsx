import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { RETURNS_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import SiteShell from "@/components/layout/SiteShell"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = RETURNS_SEO[(locale as Locale) ?? "en"] ?? RETURNS_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/returns",
    locale,
  })
}

export default function ReturnsPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Returns Policy</h1>
        <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
          <p>We offer a 100-day return policy on standard purchases. Items must be in original condition.</p>
          <p>Custom-made and auction-won items may have different return terms — contact support before returning.</p>
          <p>To start a return, visit your order details or contact us at support@Koleqcia.com.</p>
        </div>
      </div>
    </SiteShell>
  )
}
