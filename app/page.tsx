import SiteShell from "@/components/layout/SiteShell"
import HeroCarousel from "@/components/home/HeroCarousel"
import TrendingArtists from "@/components/home/TrendingArtists"
import BrandsCarousel from "@/components/home/BrandsCarousel"
import BigCategories from "@/components/home/BigCategories"
import MoreWaysSection from "@/components/home/MoreWaysSection"
import VideoSection from "@/components/home/VideoSection"
import ReviewsSection from "@/components/home/ReviewsSection"
import NewsletterSection from "@/components/home/NewsletterSection"
import HomeProductCard from "@/components/home/HomeProductCard"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { fetchPageSections, sectionContent } from "@/lib/page-sections"

type ApiProduct = {
  id: number; slug?: string; category_slug?: string; title: string; artist_name: string; base_price: string
  original_price: string | null; regional_prices?: Record<string, unknown>; rating: string; review_count: number
  image_url: string; is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean; is_featured?: boolean
  size_variants?: Array<{ id: number; label: string; price_usd: string; price_gel?: string | null; price_eur?: string | null; price_gbp?: string | null; sale_price_usd?: string | null; sale_price_gel?: string | null; is_active?: boolean }>
}

async function getTrendingProducts(): Promise<ApiProduct[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  try {
    const res = await fetch(`${apiUrl}/products/?sort=featured&page_size=8`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json() as { results: ApiProduct[] }
    return data.results ?? []
  } catch {
    return []
  }
}

export default async function HomePage() {
  const [trendingProducts, sections] = await Promise.all([
    getTrendingProducts(),
    fetchPageSections("home"),
  ])
  const moreWays = sectionContent<{ heading?: string; cards?: Array<{ id: string; label: string; desc: string; href: string; imageUrl: string; accent?: string }> }>(sections, "more_ways")
  const video = sectionContent<{ heading?: string; cards?: Array<{ id: string; label: string; thumb: string }> }>(sections, "video")
  const newsletter = sectionContent<{ heading?: string; subheading?: string; promoText?: string; imageUrl?: string }>(sections, "newsletter")
  const stats = sectionContent<{ stats?: Array<{ stat: string; label: string }> }>(sections, "stats")

  return (
    <SiteShell>
      <HeroCarousel />
      <BrandsCarousel />
      <BigCategories />

      {trendingProducts.length > 0 && (
        <section className="dp-container pb-14" aria-labelledby="trending-heading">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-3xl md:text-4xl text-dp-text-primary" id="trending-heading">Trending Now</h2>
            <Link href="/catalog?sort=trending" className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {trendingProducts.map((p) => <HomeProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <MoreWaysSection content={moreWays ?? undefined} />
      <TrendingArtists />
      <VideoSection content={video ?? undefined} />
      <ReviewsSection />
      <NewsletterSection content={newsletter ?? undefined} />

      <section className="dp-container py-12" aria-label="Social proof statistics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
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
