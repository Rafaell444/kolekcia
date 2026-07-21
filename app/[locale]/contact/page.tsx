import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { CONTACT_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import ContactPage from "./ContactPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = CONTACT_SEO[(locale as Locale) ?? "en"] ?? CONTACT_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/contact",
    locale,
  })
}

export default function Page() {
  return <ContactPage />
}
