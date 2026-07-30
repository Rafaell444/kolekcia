import type { Metadata } from "next"
import { buildPageMetadata } from "@/lib/seo"
import ResetPasswordPage from "./ResetPasswordPage"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: "Set New Password",
    path: "/reset-password",
    locale,
    robots: { index: false, follow: false },
  })
}

export default function Page() {
  return <ResetPasswordPage />
}
