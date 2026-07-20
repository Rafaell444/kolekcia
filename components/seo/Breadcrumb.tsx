import Link from "next/link"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

export type BreadcrumbItem = {
  name: string
  url: string
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
  locale?: string
}

export default function Breadcrumb({ items, locale }: BreadcrumbProps) {
  const prefix = locale ? `/${locale}` : ""

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${prefix}${item.url}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav
        className="flex items-center gap-2 text-[12px] text-dp-text-tertiary mb-6 flex-wrap"
        aria-label="Breadcrumb"
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span>/</span>}
              {isLast ? (
                <span className="text-dp-text-secondary truncate">{item.name}</span>
              ) : (
                <Link
                  href={`${prefix}${item.url}`}
                  className="hover:text-dp-text-primary transition-colors"
                >
                  {item.name}
                </Link>
              )}
            </span>
          )
        })}
      </nav>
    </>
  )
}
