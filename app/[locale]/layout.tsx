import { notFound } from "next/navigation"
import { isValidLocale, LOCALES } from "@/lib/i18n"
import { CartProvider } from "@/contexts/cart-context"

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!isValidLocale(locale)) notFound()

  return <CartProvider>{children}</CartProvider>
}
