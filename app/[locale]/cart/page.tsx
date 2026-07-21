import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import CartPage from "./CartPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Cart",
    path: "/cart",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function Page() {
  return <CartPage />
}
