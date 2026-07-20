import { notFound } from "next/navigation"
import { isValidLocale, type Locale } from "@/lib/i18n"

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!isValidLocale(locale)) notFound()

  return <>{children}</>
}
