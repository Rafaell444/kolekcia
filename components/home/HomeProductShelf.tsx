import Link from "next/link"
import { ArrowRight } from "lucide-react"
import HomeProductCard, { type HomeProduct } from "@/components/home/HomeProductCard"

type Props = {
  id: string
  title: string
  products: HomeProduct[]
  href: string
  seeAllLabel: string
}

function responsiveVisibility(index: number): string {
  if (index < 4) return ""
  if (index < 6) return "hidden sm:block"
  if (index < 8) return "hidden lg:block"
  return "hidden xl:block"
}

export default function HomeProductShelf({ id, title, products, href, seeAllLabel }: Props) {
  if (products.length === 0) return null

  return (
    <section className="dp-container pb-14" aria-labelledby={id}>
      <h2 id={id} className="mb-7 text-center font-display text-3xl uppercase text-dp-text-primary md:text-4xl">
        {title}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {products.slice(0, 12).map((product, index) => (
          <div key={product.id} className={responsiveVisibility(index)}>
            <HomeProductCard product={product} />
          </div>
        ))}
      </div>

      <div className="mt-7 flex justify-center">
        <Link
          href={href}
          className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary transition-colors hover:text-dp-text-primary"
        >
          {seeAllLabel}
          <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
