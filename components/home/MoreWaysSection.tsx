import Image from "next/image"
import Link from "next/link"

const WAYS = [
  {
    id: "limited",
    label: "Limited Editions",
    desc: "Exclusive designs. Unique finishes. Limited runs. Once they're gone — it's forever.",
    href: "/catalog?filter=limited",
    imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=600&fit=crop",
    overlay: "bg-gradient-to-t from-black/80 via-black/20 to-transparent",
  },
  {
    id: "custom",
    label: "Custom Displates",
    desc: "Turn anything you love into premium metal posters. Upload your pics and let your moments shine!",
    href: "/custom",
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
    overlay: "bg-gradient-to-t from-black/80 via-black/20 to-transparent",
  },
  {
    id: "club",
    label: "KolekciaClub",
    desc: "Perks await! Join and unlock free shipping, early access to limited drops — and more.",
    href: "/catalog",
    imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&h=600&fit=crop",
    overlay: "bg-gradient-to-t from-black/80 via-black/20 to-transparent",
    accent: "#2563eb",
  },
]

export default function MoreWaysSection({ content }: { content?: { heading?: string; cards?: typeof WAYS } }) {
  const ways = content?.cards ?? WAYS
  const heading = content?.heading ?? "More Ways to Kolekcia"
  return (
    <section className="dp-container py-14" aria-labelledby="more-ways-heading">
      <h2
        className="font-display text-3xl md:text-4xl text-center text-dp-text-primary mb-8 uppercase tracking-tight"
        id="more-ways-heading"
      >
        {heading}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {ways.map((way) => (
          <Link
            key={way.id}
            href={way.href}
            className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-dp-bg-elevated block"
            style={way.accent ? { background: way.accent } : undefined}
          >
            <Image
              src={way.imageUrl}
              alt={way.label}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className={`absolute inset-0 ${"overlay" in way && way.overlay ? way.overlay : "bg-gradient-to-t from-black/80 via-black/20 to-transparent"}`} aria-hidden />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="font-display text-xl font-black uppercase tracking-tight text-white mb-1">
                {way.label}
              </p>
              <p className="text-[12px] text-white/80 leading-relaxed">
                {way.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
