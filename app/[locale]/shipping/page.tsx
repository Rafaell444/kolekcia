import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { SHIPPING_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import SiteShell from "@/components/layout/SiteShell"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = SHIPPING_SEO[(locale as Locale) ?? "en"] ?? SHIPPING_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/shipping",
    locale,
  })
}

export default function ShippingPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Shipping Policy</h1>
        <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
          <p>We ship worldwide. Standard delivery typically takes 5–8 business days after production.</p>
          <p>Free shipping on orders over $49. Express options may be available at checkout.</p>
          <p>Custom and auction-won items follow the same production timeline unless otherwise stated.</p>
        </div>
      </div>
    </SiteShell>
  )
}
