import Image from "next/image"
import Link from "next/link"

const BIG_CATS = [
  {
    slug: "gaming",
    label: "Gaming Designs",
    cta: "See More",
    surprise: false,
    imageUrl: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=600&fit=crop",
    accent: "#1a1f2e",
  },
  {
    slug: "verified",
    label: "Verified Creators",
    cta: "See More",
    surprise: false,
    imageUrl: "https://images.unsplash.com/photo-1578301978162-7aae4d755744?w=600&h=600&fit=crop",
    accent: "#0f1e14",
  },
  {
    slug: "anime",
    label: "Anime",
    cta: "See More",
    surprise: false,
    imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=600&fit=crop",
    accent: "#1a1420",
  },
  {
    slug: "all",
    label: "Every Side of You",
    cta: "See More",
    surprise: true,
    imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=600&fit=crop",
    accent: "#0a1a20",
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {BIG_CATS.map((cat) => (
          <article
            key={cat.slug}
            className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-dp-bg-elevated"
            style={{ background: cat.accent }}
          >
            {/* Background image */}
            <Image
              src={cat.imageUrl}
              alt={cat.label}
              fill
              className="object-cover opacity-60 group-hover:opacity-75 transition-opacity duration-500"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80" aria-hidden />

            {/* Title at top */}
            <div className="absolute top-4 left-4 right-4">
              <p className="font-display text-[13px] sm:text-base font-black uppercase tracking-wider text-white drop-shadow-lg">
                {cat.label}
              </p>
            </div>

            {/* CTAs at bottom */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 flex-wrap">
              <Link
                href={`/catalog?category=${cat.slug}`}
                className="px-4 py-2 border border-white/80 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-white hover:text-black transition-colors"
              >
                {cat.cta}
              </Link>
              {cat.surprise && (
                <Link
                  href="/catalog"
                  className="px-4 py-2 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-blue-500 transition-colors"
                >
                  Surprise Me
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
