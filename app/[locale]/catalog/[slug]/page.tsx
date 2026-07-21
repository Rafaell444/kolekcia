import { notFound } from "next/navigation"
import type { Metadata } from "next"
import ProductDetail from "./ProductDetail"
import { buildPageMetadata } from "@/lib/seo"
import ProductJsonLd from "@/components/seo/ProductJsonLd"

type PageParams = { locale: string; slug: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

type ProductPayload = {
  id: number
  slug?: string
  title: string
  description?: string
  base_price: string
  status?: string
  vendor_name?: string | null
  images?: Array<{ url?: string; src?: string; media_type?: string }>
  seo?: { meta_title?: string; meta_description?: string; og_image?: string; meta_keywords?: string }
}

async function fetchProduct(slug: string, locale: string): Promise<ProductPayload | null> {
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
  const title = seo.meta_title || product.title
  const description = seo.meta_description || product.description?.slice(0, 160) || ""
  const ogImage = seo.og_image || ""

  return buildPageMetadata({
    title,
    description,
    path: `/catalog/${slug}`,
    locale,
    image: ogImage || undefined,
    keywords: seo.meta_keywords || undefined,
  })
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { locale, slug } = await params
  const product = await fetchProduct(slug, locale)
  if (!product) notFound()

  const productSlug = product.slug || slug
  const images = (product.images ?? [])
    .filter((m) => m.media_type !== "video")
    .map((m) => m.url || m.src || "")
    .filter(Boolean)
  const availability =
    product.status === "sold" || product.status === "paused" ? "OutOfStock" : "InStock"

  return (
    <>
      <ProductJsonLd
        name={product.title}
        description={product.description}
        slug={productSlug}
        locale={locale}
        image={images}
        price={product.base_price}
        currency="USD"
        availability={availability}
        sku={product.id}
        brand={product.vendor_name}
      />
      {/* API returns the full product payload; ProductDetail owns the rich client type. */}
      <ProductDetail product={product as never} />
    </>
  )
}
