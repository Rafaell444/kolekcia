import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import AuctionDetail from "./AuctionDetail"

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
  const title = seo.meta_title || `${auction.title} | Auction`
  const description =
    seo.meta_description || `Bid on ${auction.title} at Koleqcia auctions.`
  const ogImage = seo.og_image || auction.image_url || ""
  const pathKey = auction.slug || id

  return buildPageMetadata({
    title,
    description,
    path: `/auctions/${pathKey}`,
    locale,
    image: ogImage || undefined,
    keywords: seo.meta_keywords || undefined,
  })
}

export default function AuctionPage() {
  return <AuctionDetail />
}
