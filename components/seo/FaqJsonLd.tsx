import JsonLd from "./JsonLd"

export type FaqItem = {
  question: string
  answer: string
}

/** FAQPage schema for Google FAQ rich results. */
export default function FaqJsonLd({ faqs }: { faqs: FaqItem[] }) {
  if (!faqs.length) return null

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }

  return <JsonLd data={faqSchema} />
}
