// Image showcase on black background — "Why you need metal art?"
import Image from "next/image"

const VIDEO_CARDS = [
  {
    id: "v1",
    label: "Damage-resistant metal print",
    thumb: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=500&fit=crop",
  },
  {
    id: "v2",
    label: "Tool-free, magnet mounting included",
    thumb: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop",
  },
  {
    id: "v3",
    label: "Gift-ready packaging",
    thumb: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&h=500&fit=crop",
  },
]

export default function VideoSection({ content }: { content?: { heading?: string; cards?: typeof VIDEO_CARDS } }) {
  const cards = content?.cards ?? VIDEO_CARDS
  const heading = content?.heading ?? "Why You Need Metal Art From Kolekcia?"
  return (
    <section
      className="relative py-16 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0a0a 60%, #1a001a 100%)" }}
      aria-labelledby="video-section-heading"
    >
      {/* Pink gradient accent on right */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-1/3"
        style={{ background: "radial-gradient(ellipse at right center, rgba(180,0,180,0.35) 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="dp-container relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-10">
          {/* Left heading */}
          <div className="lg:w-56 xl:w-72 shrink-0 text-center lg:text-left">
            <h2
              className="font-display text-3xl xl:text-4xl font-black uppercase leading-tight text-white"
              id="video-section-heading"
            >
              {heading}
            </h2>
          </div>

          {/* Image cards */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map((v) => (
              <article key={v.id} className="group relative rounded-xl overflow-hidden bg-black/40">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={v.thumb}
                    alt={v.label}
                    fill
                    className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
                <p className="text-[12px] font-semibold text-white/90 text-center py-3 px-2">
                  {v.label}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
