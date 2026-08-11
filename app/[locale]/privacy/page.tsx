import type { Metadata } from "next"
import { type Locale } from "@/lib/i18n"
import { PRIVACY_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import SiteShell from "@/components/layout/SiteShell"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = PRIVACY_SEO[(locale as Locale) ?? "en"] ?? PRIVACY_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/privacy",
    locale,
  })
}
const CONTENT = {
  ka: {
    title: "კონფიდენციალურობა",
    intro: "Koleqcia პატივს სცემს თქვენს პირად მონაცემებს და ამ პოლიტიკაში განმარტავს, რა ინფორმაციას ვაგროვებთ, რატომ ვიყენებთ მას და როგორ შეგიძლიათ თქვენი უფლებების განხორციელება.",
    sections: [
      ["რა ინფორმაციას ვაგროვებთ", "ვაგროვებთ ანგარიშის მონაცემებს, საკონტაქტო ინფორმაციას, მიწოდების მისამართებს, შეკვეთებისა და გადახდების ჩანაწერებს, მხარდაჭერის მიმოწერას და ვებსაიტის გამოყენებასთან დაკავშირებულ ტექნიკურ მონაცემებს."],
      ["როგორ ვიყენებთ მონაცემებს", "მონაცემებს ვიყენებთ შეკვეთების დასამუშავებლად, მიწოდების ორგანიზებისთვის, მომხმარებელთა მხარდაჭერისთვის, უსაფრთხოების უზრუნველსაყოფად, თაღლითობის პრევენციისთვის და იმ შეტყობინებების გასაგზავნად, რომლებზეც თანხმობა გაქვთ მოცემული."],
      ["მონაცემების დაცვა", "ვიყენებთ ადმინისტრაციულ, ტექნიკურ და ორგანიზაციულ ზომებს, მათ შორის წვდომის შეზღუდვას, დაცულ კავშირებს და სისტემურ კონტროლს, რათა შევამციროთ არაავტორიზებული წვდომის ან მონაცემთა დაკარგვის რისკი."],
      ["თქვენი უფლებები", "შეგიძლიათ მოითხოვოთ თქვენს მონაცემებზე წვდომა, შესწორება, წაშლა ან დამუშავების შეზღუდვა. მოთხოვნებისთვის დაგვიკავშირდით support@Koleqcia.com-ზე."],
    ],
  },
  en: {
    title: "Privacy Policy",
    intro: "Koleqcia respects your privacy. This policy explains what data we collect, how we use it, and your rights.",
    sections: [
      ["Information We Collect", "We collect account information, contact details, shipping addresses, order and payment records, support messages, and technical usage data needed to operate the marketplace."],
      ["How We Use Data", "We use data to process orders, arrange delivery, provide customer support, maintain security, prevent fraud, improve our services, and send updates you have opted into."],
      ["Data Protection", "We use administrative, technical, and organizational controls, including limited access, secure connections, and system monitoring, to reduce unauthorized access or data loss risks."],
      ["Your Rights", "You may request access, correction, deletion, or restriction of your personal data by contacting support@Koleqcia.com."],
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    intro: "Koleqcia уважает вашу конфиденциальность. В этой политике объясняется, какие данные мы собираем, с какой целью их используем и какие права доступны вам как пользователю.",
    sections: [
      ["Какие данные мы собираем", "Мы собираем данные учетной записи, контактную информацию, адреса доставки, сведения о заказах и платежах, обращения в службу поддержки, а также технические данные, необходимые для работы маркетплейса."],
      ["Как мы используем данные", "Мы используем данные для обработки заказов, организации доставки, поддержки клиентов, обеспечения безопасности, предотвращения мошенничества, улучшения сервиса и отправки уведомлений, на которые вы дали согласие."],
      ["Защита данных", "Мы применяем административные, технические и организационные меры, включая ограничение доступа, защищенные соединения и системный контроль, чтобы снизить риск несанкционированного доступа или потери данных."],
      ["Ваши права", "Вы можете запросить доступ к своим персональным данным, их исправление, удаление или ограничение обработки, связавшись с нами по адресу support@Koleqcia.com."],
    ],
  },
} as const

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const content = CONTENT[(locale as keyof typeof CONTENT)] ?? CONTENT.en
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">{content.title}</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="prose prose-sm text-dp-text-secondary space-y-4 text-[14px] leading-relaxed">
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
