import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import InboxPage from "./InboxPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Inbox",
    path: "/inbox",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function Page() {
  return <InboxPage />
}
