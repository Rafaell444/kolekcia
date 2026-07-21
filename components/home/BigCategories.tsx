import Image from "next/image"
import LocalizedLink from "@/components/seo/LocalizedLink"

const BIG_CATS = [
  {
    slug: "figures",
    label: "Premium Figures",
    cta: "Shop Figures",
    imageUrl: "https://images.unsplash.com/photo-1608889335941-32ac5f2041b9?w=800&h=1000&fit=crop",
    accent: "#1a1420",
  },
  {
    slug: "wallpanels",
    label: "Wall Panels",
    cta: "Shop Wallpanels",
    imageUrl: "https://images.unsplash.com/photo-1578301978162-7aae4d755744?w=800&h=1000&fit=crop",
    accent: "#0f1e14",
  },
]

export default function BigCategories() {
  return (
    <section className="dp-container py-14" aria-labelledby="big-categories-heading">
      <h2
        className="font-display text-3xl md:text-4xl text-center text-dp-text-primary mb-8 uppercase tracking-tight"
        id="big-categories-heading"
      >
        Show Off What Makes You, You
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        {BIG_CATS.map((cat) => (
          <article
            key={cat.slug}
            className="group relative rounded-xl overflow-hidden aspect-[4/3] sm:aspect-[16/9] bg-dp-bg-elevated"
            style={{ background: cat.accent }}
          >
            <Image
              src={cat.imageUrl}
              alt={cat.label}
              fill
              className="object-cover opacity-60 group-hover:opacity-75 transition-opacity duration-500"
              sizes="(max-width: 768px) 50vw, 48vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80" aria-hidden />
            <div className="absolute top-4 left-4 right-4">
              <p className="font-display text-[13px] sm:text-lg font-black uppercase tracking-wider text-white drop-shadow-lg">
                {cat.label}
              </p>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <LocalizedLink
                href={`/catalog?category=${cat.slug}`}
                className="inline-block px-4 py-2 border border-white/80 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-white hover:text-black transition-colors"
              >
                {cat.cta}
              </LocalizedLink>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
