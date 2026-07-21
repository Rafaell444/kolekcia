import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import CheckoutPage from "./CheckoutPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Checkout",
    path: "/checkout",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function Page() {
  return <CheckoutPage />
}
