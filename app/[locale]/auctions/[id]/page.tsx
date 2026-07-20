import type { Metadata } from "next"
import { LOCALES } from "@/lib/i18n"
import AuctionDetail from "./AuctionDetail"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

type PageParams = { locale: string; id: string }

async function fetchAuction(id: string, locale: string) {
  try {
    const res = await fetch(`${API_URL}/auctions/${id}/?lang=${locale}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>
}): Promise<Metadata> {
  const { locale, id } = await params
  const auction = await fetchAuction(id, locale)
  if (!auction) return { title: "Auction Not Found" }

  const seo = auction.seo ?? {}
  const title = seo.meta_title || `${auction.title} | Auction | Kolekcia`
  const description =
    seo.meta_description || `Bid on ${auction.title} at Kolekcia auctions.`
  const ogImage = seo.og_image || auction.image_url || ""

  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) {
    alternates[loc] = `${SITE_URL}/${loc}/auctions/${id}`
  }

  return {
    title,
    description,
    keywords: seo.meta_keywords || undefined,
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      locale,
      type: "website",
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}/auctions/${id}`,
      languages: alternates,
    },
  }
}

export default function AuctionPage() {
  return <AuctionDetail />
}
