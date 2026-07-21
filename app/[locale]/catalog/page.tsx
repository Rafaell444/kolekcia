import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { CATALOG_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import CatalogPage from "./CatalogPage"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

type CategorySeo = {
  slug: string
  name: string
  seo?: {
    meta_title?: string
    meta_description?: string
    meta_keywords?: string
    og_image?: string
  }
}

async function fetchCategorySeo(slug: string, locale: string): Promise<CategorySeo | null> {
  try {
    const res = await fetch(`${API_URL}/products/categories/?lang=${locale}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const categories = (Array.isArray(data) ? data : data.results ?? []) as CategorySeo[]
    return categories.find((c) => c.slug === slug) ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const { category } = await searchParams
  const fallback = CATALOG_SEO[(locale as Locale) ?? "en"] ?? CATALOG_SEO.en

  let title = fallback.title
  let description = fallback.description
  let image: string | undefined
  let keywords: string | undefined
  let path = "/catalog"

  if (category) {
    const cat = await fetchCategorySeo(category, locale)
    const seo = cat?.seo
    if (seo?.meta_title) title = seo.meta_title
    if (seo?.meta_description) description = seo.meta_description
    if (seo?.meta_keywords) keywords = seo.meta_keywords
    if (seo?.og_image) image = seo.og_image
    path = `/catalog?category=${encodeURIComponent(category)}`
  }

  return buildPageMetadata({
    title,
    description,
    path,
    locale,
    image,
    keywords,
  })
}

export default function Page() {
  return <CatalogPage />
}
