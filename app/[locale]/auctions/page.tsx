import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { AUCTIONS_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import AuctionsPage from "./AuctionsPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = AUCTIONS_SEO[(locale as Locale) ?? "en"] ?? AUCTIONS_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/auctions",
    locale,
  })
}

export default function Page() {
  return <AuctionsPage />
}
