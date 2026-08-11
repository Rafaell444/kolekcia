import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { TERMS_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import SiteShell from "@/components/layout/SiteShell"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = TERMS_SEO[(locale as Locale) ?? "en"] ?? TERMS_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/terms",
    locale,
  })
}
const CONTENT = {
  ka: {
    title: "წესები",
    intro: "Koleqcia-ს გამოყენებით თქვენ ეთანხმებით ქვემოთ მოცემულ წესებს. გთხოვთ, ყურადღებით გაეცნოთ მათ ანგარიშის შექმნამდე, შეკვეთის განთავსებამდე ან აუქციონში მონაწილეობამდე.",
    sections: [
      ["ანგარიში", "თქვენ პასუხისმგებელი ხართ ანგარიშის მონაცემების სისწორეზე, პაროლის დაცვაზე და თქვენი ანგარიშით განხორციელებულ ყველა მოქმედებაზე."],
      ["შეკვეთები და გადახდა", "ფასები ნაჩვენებია არჩეულ ვალუტაში. საბოლოო თანხა, მიწოდება, ფასდაკლებები და დამატებითი სერვისები დადასტურდება checkout-ის ეტაპზე. აუქციონში განთავსებული ბიდი სავალდებულოა."],
      ["მიწოდება და დაბრუნება", "მიწოდების ვადები დამოკიდებულია პროდუქტზე, დამუშავების დროზე, ქვეყანასა და კურიერზე. დაბრუნება განიხილება მოქმედი დაბრუნების პოლიტიკის და პროდუქტის მდგომარეობის შესაბამისად."],
      ["ინტელექტუალური საკუთრება", "ნამუშევრები და დიზაინები ეკუთვნის შესაბამის ავტორებს ან უფლებების მფლობელებს. შეძენა გაძლევთ პირადი გამოყენებისა და გამოფენის უფლებას, არა კომერციულ გადაყიდვის ან რეპროდუქციის უფლებას."],
    ],
  },
  en: {
    title: "Terms of Service",
    intro: "By using Koleqcia you agree to these terms. Please read them carefully before creating an account, placing an order, or bidding in an auction.",
    sections: [
      ["Accounts", "You are responsible for accurate account information, keeping your password secure, and all activity made through your account."],
      ["Purchases and Payment", "Prices are shown in your selected currency. Final charges, shipping, discounts, and optional services are confirmed at checkout. Auction bids are binding."],
      ["Shipping and Returns", "Delivery timelines depend on the product, processing time, destination, and carrier. Returns are reviewed under the active returns policy and item condition."],
      ["Intellectual Property", "Artwork remains the property of the relevant artists or rights holders. A purchase grants personal display rights, not commercial resale or reproduction rights."],
    ],
  },
  ru: {
    title: "Условия использования",
    intro: "Используя Koleqcia, вы соглашаетесь с настоящими условиями. Пожалуйста, внимательно ознакомьтесь с ними до создания аккаунта, оформления заказа или участия в аукционе.",
    sections: [
      ["Аккаунт", "Вы несете ответственность за достоверность данных аккаунта, сохранность пароля и все действия, совершенные через вашу учетную запись."],
      ["Заказы и оплата", "Цены отображаются в выбранной вами валюте. Итоговая сумма, доставка, скидки и дополнительные услуги подтверждаются на этапе checkout. Ставки на аукционах являются обязательными."],
      ["Доставка и возврат", "Сроки доставки зависят от продукта, времени обработки, страны назначения и перевозчика. Возвраты рассматриваются в соответствии с действующей политикой возврата и состоянием товара."],
      ["Интеллектуальная собственность", "Работы и дизайны остаются собственностью соответствующих авторов или правообладателей. Покупка предоставляет право личного использования и демонстрации, но не право коммерческой перепродажи или воспроизведения."],
    ],
  },
} as const

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const content = CONTENT[(locale as keyof typeof CONTENT)] ?? CONTENT.en
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">{content.title}</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
          <p>{content.intro}</p>
          {content.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="font-display text-2xl text-dp-text-primary mt-8">{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </div>
    </SiteShell>
  )
}
