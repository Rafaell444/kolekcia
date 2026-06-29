import SiteShell from "@/components/layout/SiteShell"
import HeroCarousel from "@/components/home/HeroCarousel"
import TrendingArtists from "@/components/home/TrendingArtists"
import BrandsCarousel from "@/components/home/BrandsCarousel"
import BigCategories from "@/components/home/BigCategories"
import MoreWaysSection from "@/components/home/MoreWaysSection"
import VideoSection from "@/components/home/VideoSection"
import ReviewsSection from "@/components/home/ReviewsSection"
import NewsletterSection from "@/components/home/NewsletterSection"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"

type ApiProduct = {
  id: number; title: string; artist_name: string; base_price: string
  original_price: string | null; rating: string; review_count: number
  image_url: string; is_limited: boolean; is_sale: boolean; is_new: boolean; is_exclusive: boolean
}

function ProductCard({ product }: { product: ApiProduct }) {
  const price = parseFloat(product.base_price)
  const original = product.original_price ? parseFloat(product.original_price) : null
  const discount = original ? Math.round(((original - price) / original) * 100) : null

  return (
    <Link href={`/catalog/${product.id}`}>
      <article className="group relative bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden dp-card-hover cursor-pointer">
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {product.is_limited && <span className="badge-limited">Limited</span>}
          {product.is_sale && discount && <span className="badge-sale">-{discount}%</span>}
          {product.is_new && <span className="badge-limited" style={{ background: "var(--dp-success)", color: "#fff" }}>New</span>}
          {product.is_exclusive && <span className="badge-limited" style={{ background: "var(--dp-accent-gold)", color: "#111113" }}>Exclusive</span>}
        </div>
        <div className="aspect-poster relative overflow-hidden bg-dp-bg-elevated">
          {product.image_url && (
            <Image src={product.image_url} alt={product.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
          )}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-dp-bg-base/90 px-3 py-2.5">
            <span className="w-full block text-[11px] font-bold uppercase tracking-widest text-white bg-dp-accent-cta hover:bg-dp-accent-cta-hover py-1.5 rounded-sm text-center">+ Add to Cart</span>
          </div>
        </div>
        <div className="p-3">
          <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest truncate mb-0.5">{product.artist_name}</p>
          <h3 className="text-[13px] font-semibold text-dp-text-primary truncate leading-tight">{product.title}</h3>
          <div className="flex items-center gap-1 mt-1 mb-2">
            <Star size={10} className="fill-dp-accent-gold text-dp-accent-gold" aria-hidden />
            <span className="text-[11px] text-dp-text-secondary">{parseFloat(product.rating).toFixed(1)}</span>
            <span className="text-[11px] text-dp-text-tertiary">({product.review_count.toLocaleString()})</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold text-dp-text-primary">${price.toFixed(2)}</span>
            {original && <span className="text-[12px] text-dp-text-tertiary line-through">${original.toFixed(2)}</span>}
          </div>
        </div>
      </article>
    </Link>
  )
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
  const trendingProducts = await getTrendingProducts()

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
            {trendingProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <MoreWaysSection />
      <TrendingArtists />
      <VideoSection />
      <ReviewsSection />
      <NewsletterSection />

      <section className="dp-container py-12" aria-label="Social proof statistics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { stat: "2.5M+", label: "Designs available" },
            { stat: "150K+", label: "Artist creators" },
            { stat: "4.8★",  label: "Average rating" },
            { stat: "100+",  label: "Countries shipped" },
          ].map(({ stat, label }) => (
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
