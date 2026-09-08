import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { HOMEPAGE_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import { getMessages } from "@/lib/messages"
import SiteShell from "@/components/layout/SiteShell"
import HeroCarousel from "@/components/home/HeroCarousel"
import BrandsCarousel from "@/components/home/BrandsCarousel"
import BigCategories from "@/components/home/BigCategories"
import VideoSection from "@/components/home/VideoSection"
import ReviewsSection from "@/components/home/ReviewsSection"
import NewsletterSection from "@/components/home/NewsletterSection"
import CategoryProductBrowser from "@/components/home/CategoryProductBrowser"
import type { HomeCategoryProducts } from "@/components/home/CategoryProductBrowser"
import type { HomeProduct } from "@/components/home/HomeProductCard"
import HomeProductShelf from "@/components/home/HomeProductShelf"
import { fetchPageSections, sectionContent } from "@/lib/page-sections"
import OrganizationJsonLd from "@/components/seo/OrganizationJsonLd"

type ApiCategory = {
  id: number
  name: string
  slug: string
  count: number
}

const CATEGORY_PRIORITY: Record<string, number> = { figures: 0, wallpanels: 1 }

async function getCategoryProducts(locale: string): Promise<HomeCategoryProducts[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  try {
    const categoryResponse = await fetch(`${apiUrl}/products/categories/?lang=${locale}`, {
      headers: { "Accept-Language": locale },
      cache: "no-store",
    })
    if (!categoryResponse.ok) return []

    const categories = (await categoryResponse.json() as ApiCategory[])
      .filter((category) => category.count > 0)
      .sort((a, b) => {
        const aPriority = CATEGORY_PRIORITY[a.slug.toLowerCase()] ?? 2
        const bPriority = CATEGORY_PRIORITY[b.slug.toLowerCase()] ?? 2
        return aPriority - bPriority
      })

    const groups = await Promise.all(categories.map(async (category) => {
      const params = new URLSearchParams({
        category: category.slug,
        sort: "featured",
        page_size: "18",
        lang: locale,
      })
      const productResponse = await fetch(`${apiUrl}/products/?${params.toString()}`, {
        headers: { "Accept-Language": locale },
        cache: "no-store",
      })
      if (!productResponse.ok) return null
      const data = await productResponse.json() as { results?: HomeProduct[] }
      const products = (data.results ?? []).slice(0, 18)
      return products.length > 0
        ? { id: category.id, name: category.name, slug: category.slug, products }
        : null
    }))

    return groups.filter((group): group is HomeCategoryProducts => group !== null)
  } catch {
    return []
  }
}

async function getHomepageProducts(locale: string, filter: "featured" | "sale" | "limited"): Promise<HomeProduct[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  const params = new URLSearchParams({
    [filter]: "true",
    sort: "featured",
    page_size: "12",
    lang: locale,
  })
  try {
    const response = await fetch(`${apiUrl}/products/?${params.toString()}`, {
      headers: { "Accept-Language": locale },
      cache: "no-store",
    })
    if (!response.ok) return []
    const data = await response.json() as { results?: HomeProduct[] }
    return (data.results ?? []).slice(0, 12)
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = HOMEPAGE_SEO[(locale as Locale) ?? "en"] ?? HOMEPAGE_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/",
    locale,
  })
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = getMessages(locale)
  const [categoryProducts, trendingProducts, saleProducts, limitedProducts, sections] = await Promise.all([
    getCategoryProducts(locale),
    getHomepageProducts(locale, "featured"),
    getHomepageProducts(locale, "sale"),
    getHomepageProducts(locale, "limited"),
    fetchPageSections("home", locale),
  ])
  const video = sectionContent<{ heading?: string; cards?: Array<{ id: string; label: string; thumb: string }> }>(sections, "video", locale)
  const newsletter = sectionContent<{ heading?: string; subheading?: string; promoText?: string; imageUrl?: string }>(sections, "newsletter", locale)
  const stats = sectionContent<{ stats?: Array<{ stat: string; label: string }> }>(sections, "stats", locale)

  return (
    <SiteShell>
      <OrganizationJsonLd />
      <HeroCarousel />
      <BrandsCarousel />
      <BigCategories />

      <CategoryProductBrowser
        categories={categoryProducts}
        locale={locale}
        heading={t.home.browseProducts}
        seeAllLabel={t.common.seeAllProducts}
      />

      <HomeProductShelf
        id="trending-products-heading"
        title={t.home.trending}
        products={trendingProducts}
        href={`/${locale}/catalog?filter=trending`}
        seeAllLabel={t.common.seeAllProducts}
      />
      <HomeProductShelf
        id="sale-products-heading"
        title={t.home.onSale}
        products={saleProducts}
        href={`/${locale}/catalog?filter=sale`}
        seeAllLabel={t.common.seeAllProducts}
      />
      <HomeProductShelf
        id="limited-products-heading"
        title={t.home.limitedEdition}
        products={limitedProducts}
        href={`/${locale}/catalog?filter=limited`}
        seeAllLabel={t.common.seeAllProducts}
      />

      <VideoSection content={video ?? undefined} />
      <ReviewsSection />
      <NewsletterSection content={newsletter ?? undefined} />

      <section className="dp-container py-12" aria-label="Social proof statistics">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center max-w-4xl mx-auto">
          {(stats?.stats ?? [
            { stat: "2.5M+", label: "Designs available" },
            { stat: "150K+", label: "Artist creators" },
            { stat: "100+", label: "Countries shipped" },
          ]).map(({ stat, label }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="font-display text-4xl md:text-5xl text-dp-text-primary">{stat}</span>
              <span className="text-[12px] text-dp-text-tertiary uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}
