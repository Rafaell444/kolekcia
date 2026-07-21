import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import RegisterPage from "./RegisterPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Create Account",
    path: "/register",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function Page() {
  return <RegisterPage />
}
