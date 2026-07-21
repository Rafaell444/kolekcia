import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import ForgotPasswordPage from "./ForgotPasswordPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Reset Password",
    path: "/forgot-password",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function Page() {
  return <ForgotPasswordPage />
}
