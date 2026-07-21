import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import AccountLayoutClient from "./AccountLayoutClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Account",
    path: "/account",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountLayoutClient>{children}</AccountLayoutClient>
}
