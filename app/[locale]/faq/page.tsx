import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { FAQ_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import FaqJsonLd from "@/components/seo/FaqJsonLd"
import FaqPage from "./FaqPage"

type Faq = { id: number; question: string; answer: string; category: string; order: number }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

async function fetchFaqs(): Promise<Faq[]> {
  try {
    const res = await fetch(`${API_URL}/cms/faqs/`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = FAQ_SEO[(locale as Locale) ?? "en"] ?? FAQ_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/faq",
    locale,
  })
}

export default async function Page() {
  const faqs = await fetchFaqs()

  return (
    <>
      <FaqJsonLd faqs={faqs} />
      <FaqPage initialFaqs={faqs} />
    </>
  )
}
