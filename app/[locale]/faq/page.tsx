import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { FAQ_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import FaqJsonLd from "@/components/seo/FaqJsonLd"
import FaqPage from "./FaqPage"

type Faq = {
  id: number
  question: string; question_ka?: string
  answer: string; answer_ka?: string
  category: string; category_ka?: string
  order: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

async function fetchFaqs(locale: string): Promise<Faq[]> {
  try {
    const res = await fetch(`${API_URL}/cms/faqs/?lang=${locale}`, {
      headers: { "Accept-Language": locale },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json() as Faq[]
    if (!Array.isArray(data)) return []
    if (locale !== "ka") return data
    return data
      .map((faq) => ({
        ...faq,
        question: faq.question_ka?.trim() || faq.question,
        answer: faq.answer_ka?.trim() || faq.answer,
        category: faq.category_ka?.trim() || faq.category,
      }))
      .filter((faq) => faq.question.trim() && faq.answer.trim())
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

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const faqs = await fetchFaqs(locale)

  return (
    <>
      <FaqJsonLd faqs={faqs} />
      <FaqPage initialFaqs={faqs} />
    </>
  )
}
