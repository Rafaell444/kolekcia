import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { ABOUT_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import AboutPage from "./AboutPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = ABOUT_SEO[(locale as Locale) ?? "en"] ?? ABOUT_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/about",
    locale,
  })
}

export default function Page() {
  return <AboutPage />
}
