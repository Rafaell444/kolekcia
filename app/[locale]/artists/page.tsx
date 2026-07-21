import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { ARTISTS_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import ArtistsPage from "./ArtistsPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = ARTISTS_SEO[(locale as Locale) ?? "en"] ?? ARTISTS_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/artists",
    locale,
  })
}

export default function Page() {
  return <ArtistsPage />
}
