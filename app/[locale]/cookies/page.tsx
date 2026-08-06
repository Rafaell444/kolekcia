import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { COOKIES_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import SiteShell from "@/components/layout/SiteShell"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = COOKIES_SEO[(locale as Locale) ?? "en"] ?? COOKIES_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/cookies",
    locale,
  })
}

const CONTENT = {
  ka: {
    title: "ქუქი-ფაილები",
    intro: "Koleqcia იყენებს ქუქი-ფაილებსა და მსგავს ტექნოლოგიებს, რათა საიტი იყოს უსაფრთხო, სწრაფი და მომხმარებლისთვის მოსახერხებელი.",
    sections: [
      ["აუცილებელი ქუქი-ფაილები", "აუცილებელი ქუქი-ფაილები საჭიროა ავტორიზაციისთვის, კალათის შესანარჩუნებლად, checkout-ის მუშაობისთვის და უსაფრთხოების ძირითადი ფუნქციებისთვის. მათი გამორთვა საიტის ნაწილს შეზღუდავს."],
      ["პრეფერენციების ქუქი-ფაილები", "ეს ფაილები ინახავს თქვენს ენას, ვალუტას და სხვა არჩევანს, რათა ყოველი ვიზიტისას გამოცდილება იყოს თანმიმდევრული."],
      ["ანალიტიკა", "ანალიტიკური მონაცემები გვეხმარება გავიგოთ, რომელი გვერდები მუშაობს კარგად, სად ჩნდება შეცდომები და როგორ გავაუმჯობესოთ მომხმარებლის გამოცდილება."],
      ["მართვა", "ქუქი-ფაილების მართვა შეგიძლიათ ბრაუზერის პარამეტრებიდან. აუცილებელი ქუქი-ფაილების შეზღუდვამ შეიძლება გავლენა მოახდინოს ანგარიშზე, კალათასა და გადახდაზე."],
    ],
  },
  en: {
    title: "Cookie Policy",
    intro: "Koleqcia uses cookies and similar technologies to keep the site secure, fast, and convenient.",
    sections: [
      ["Essential Cookies", "Essential cookies are required for authentication, cart persistence, checkout, and core security functionality. Disabling them may limit parts of the site."],
      ["Preference Cookies", "These files remember your language, currency, and other choices so your experience remains consistent across visits."],
      ["Analytics", "Analytics data helps us understand which pages work well, where errors happen, and how to improve the customer experience."],
      ["Managing Cookies", "You can manage cookies through your browser settings. Restricting essential cookies may affect accounts, cart, and payment flows."],
    ],
  },
  ru: {
    title: "Политика cookies",
    intro: "Koleqcia использует cookies и аналогичные технологии, чтобы сайт оставался безопасным, быстрым и удобным для пользователей.",
    sections: [
      ["Обязательные cookies", "Обязательные cookies необходимы для авторизации, сохранения корзины, работы checkout и основных функций безопасности. Их отключение может ограничить работу отдельных частей сайта."],
      ["Cookies предпочтений", "Эти файлы сохраняют выбранный язык, валюту и другие настройки, чтобы ваш опыт оставался последовательным при каждом посещении."],
      ["Аналитика", "Аналитические данные помогают нам понимать, какие страницы работают хорошо, где возникают ошибки и как улучшить пользовательский опыт."],
      ["Управление cookies", "Вы можете управлять cookies в настройках браузера. Ограничение обязательных cookies может повлиять на работу аккаунта, корзины и платежных процессов."],
    ],
  },
} as const

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
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
