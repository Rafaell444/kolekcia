import type { Metadata } from "next"
import { LOCALES, type Locale } from "@/lib/i18n"
import { FAQ_SEO } from "@/lib/seo-metadata"
import FaqPage from "./FaqPage"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = FAQ_SEO[(locale as Locale) ?? "en"] ?? FAQ_SEO.en

  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) {
    alternates[loc] = `${SITE_URL}/${loc}/faq`
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
      canonical: `${SITE_URL}/${locale}/faq`,
      languages: alternates,
    },
  }
}

export default function Page() {
  return <FaqPage />
}
