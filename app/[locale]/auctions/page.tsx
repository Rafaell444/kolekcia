import type { Metadata } from "next"
import { LOCALES, type Locale } from "@/lib/i18n"
import { AUCTIONS_SEO } from "@/lib/seo-metadata"
import AuctionsPage from "./AuctionsPage"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = AUCTIONS_SEO[(locale as Locale) ?? "en"] ?? AUCTIONS_SEO.en

  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) {
    alternates[loc] = `${SITE_URL}/${loc}/auctions`
  }

  return {
    title: seo.title,
    description: seo.description,
    openGraph: {
      title: seo.title,
      description: seo.description,
      locale,
      type: "website",
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}/auctions`,
      languages: alternates,
    },
  }
}

export default function Page() {
  return <AuctionsPage />
}
