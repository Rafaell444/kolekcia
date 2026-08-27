import type { Metadata } from "next"
import PaymentHandoffPage from "./PaymentHandoffPage"

export const metadata: Metadata = {
  title: "Secure Payment",
  robots: { index: false, follow: false },
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return <PaymentHandoffPage locale={locale} />
}
