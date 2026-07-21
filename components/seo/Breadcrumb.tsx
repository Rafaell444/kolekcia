import Link from "next/link"
import JsonLd from "./JsonLd"
import { SITE_URL } from "@/lib/seo"

export type BreadcrumbItem = {
  name: string
  url: string
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
  /** Locale prefix for all breadcrumb URLs (e.g. "en"). Required for correct hreflang paths. */
  locale: string
}

function toAbsoluteBreadcrumbUrl(locale: string, itemUrl: string): string {
  if (/^https?:\/\//i.test(itemUrl)) return itemUrl
  const prefix = `/${locale}`
  if (!itemUrl || itemUrl === "/") return `${SITE_URL}${prefix}`
  const path = itemUrl.startsWith("/") ? itemUrl : `/${itemUrl}`
  return `${SITE_URL}${prefix}${path}`
}

export default function Breadcrumb({ items, locale }: BreadcrumbProps) {
  const prefix = `/${locale}`

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: toAbsoluteBreadcrumbUrl(locale, item.url),
    })),
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <nav
        className="flex items-center gap-2 text-[12px] text-dp-text-tertiary mb-6 flex-wrap"
        aria-label="Breadcrumb"
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          const href =
            !item.url || item.url === "/"
              ? prefix
              : `${prefix}${item.url.startsWith("/") ? item.url : `/${item.url}`}`
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span>/</span>}
              {isLast ? (
                <span className="text-dp-text-secondary truncate">{item.name}</span>
              ) : (
                <Link
                  href={href}
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
