import JsonLd from "./JsonLd"
import { SITE_URL, absoluteUrl } from "@/lib/seo"

type ProductJsonLdProps = {
  name: string
  description?: string
  slug: string
  locale: string
  image?: string | string[] | null
  price: string | number
  currency?: string
  availability?: "InStock" | "OutOfStock" | "PreOrder"
  sku?: string | number
  /** Vendor / shop brand (e.g. MangaMoon, Sculpi). */
  brand?: string | null
}

export default function ProductJsonLd({
  name,
  description,
  slug,
  locale,
  image,
  price,
  currency = "USD",
  availability = "InStock",
  sku,
  brand,
}: ProductJsonLdProps) {
  const rawImages = Array.isArray(image) ? image : image ? [image] : []
  const images = rawImages.filter(Boolean).map((src) => absoluteUrl(String(src)))
  const priceStr = typeof price === "number" ? price.toFixed(2) : String(price)
  const brandName = (brand && String(brand).trim()) || "Koleqcia"

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(sku != null ? { sku: String(sku) } : {}),
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/${locale}/catalog/${slug}`,
      priceCurrency: currency,
      price: priceStr,
      availability: `https://schema.org/${availability}`,
      itemCondition: "https://schema.org/NewCondition",
    },
  }

  return <JsonLd data={productSchema} />
}
