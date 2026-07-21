import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import LoginPage from "./LoginPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Sign In",
    path: "/login",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function Page() {
  return <LoginPage />
}
