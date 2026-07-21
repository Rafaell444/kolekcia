import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { CUSTOM_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import CustomPage from "./CustomPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = CUSTOM_SEO[(locale as Locale) ?? "en"] ?? CUSTOM_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/custom",
    locale,
  })
}

export default function Page() {
  return <CustomPage />
}
