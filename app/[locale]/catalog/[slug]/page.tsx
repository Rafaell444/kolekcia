import { notFound } from "next/navigation"
import type { Metadata } from "next"
import ProductDetail from "./ProductDetail"
import { LOCALES, type Locale } from "@/lib/i18n"

type PageParams = { locale: string; slug: string }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

async function fetchProduct(slug: string, locale: string) {
  const res = await fetch(`${API_URL}/products/${slug}/?lang=${locale}`, {
    next: { revalidate: 60 },
  }).catch(() => null)
  if (!res || !res.ok) return null
  return res.json()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const product = await fetchProduct(slug, locale)
  if (!product) return { title: "Product Not Found" }

  const seo = product.seo ?? {}
  const title = seo.meta_title || `${product.title} | Kolekcia`
  const description = seo.meta_description || product.description?.slice(0, 160) || ""
  const ogImage = seo.og_image || ""

  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) {
    alternates[loc] = `${SITE_URL}/${loc}/catalog/${slug}`
  }

  return {
    title,
    description,
    keywords: seo.meta_keywords || undefined,
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      locale,
      type: "website",
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}/catalog/${slug}`,
      languages: alternates,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { locale, slug } = await params
  const product = await fetchProduct(slug, locale)
  if (!product) notFound()
  return <ProductDetail product={product} />
}
