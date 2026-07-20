import type { Metadata } from "next"
import { LOCALES } from "@/lib/i18n"
import CatalogPage from "./CatalogPage"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) {
    alternates[loc] = `${SITE_URL}/${loc}/catalog`
  }

  return {
    title: "Shop All | Kolekcia",
    description: "Browse the full Kolekcia catalog. Discover unique figures, wall panels, and collectible art.",
    alternates: {
      canonical: `${SITE_URL}/${locale}/catalog`,
      languages: alternates,
    },
  }
}

export default function Page() {
  return <CatalogPage />
}
