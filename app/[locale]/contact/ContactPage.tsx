"use client"

import React, { useState, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import { apiFetch } from "@/lib/api"
import { sectionContent, type PageSection } from "@/lib/page-sections"
import { usePageSections } from "@/lib/use-page-sections"
import LocalizedLink from "@/components/seo/LocalizedLink"
import {
  Mail, Phone, MapPin, Package,
  RotateCcw, Truck, Brush, ArrowRight, ChevronDown,
  ChevronUp, CheckCircle2, Clock, Zap, Upload,
} from "lucide-react"

type ContactReason = { icon?: string; label: string; desc: string }
type InfoCard = { icon?: string; title: string; points: string[] }

type ContactHeroContent = {
  eyebrow?: string
  headline?: string
  subline?: string
  responseLabel?: string
  responseValue?: string
}
type ContactReasonsContent = { eyebrow?: string; cards?: ContactReason[] }
type ContactFormIntroContent = { heading?: string; body?: string }
type ContactSidebarContent = { promiseTitle?: string; promiseBody?: string; homeEyebrow?: string; address?: string }
type ContactFaqIntroContent = { eyebrow?: string; heading?: string; body?: string }
type ContactShippingContent = { cards?: InfoCard[] }
type ContactBottomCtaContent = { eyebrow?: string; heading?: string; body?: string; cta?: string }

// ── Contact reason cards ──────────────────────────────────
const CONTACT_REASONS = [
  {
    icon: <Package size={20} />,
    label: "Order Issue",
    desc: "Damaged item, missing parcel, or wrong product.",
    color: "text-dp-accent-cta",
    bg: "bg-dp-accent-cta/10",
  },
  {
    icon: <Truck size={20} />,
    label: "Shipping",
    desc: "Tracking, delivery estimates, or address changes.",
    color: "text-dp-accent-gold",
    bg: "bg-dp-accent-gold/10",
  },
  {
    icon: <RotateCcw size={20} />,
    label: "Returns",
    desc: "Start a return or ask about our 100-day guarantee.",
    color: "text-dp-success",
    bg: "bg-dp-success/10",
  },
  {
    icon: <Brush size={20} />,
    label: "Artist Support",
    desc: "Licensing, royalties, and creator partnership queries.",
    color: "text-dp-text-secondary",
    bg: "bg-dp-bg-elevated",
  },
]

const DEFAULT_CONTACT_HERO = {
  eyebrow: "Get in Touch",
  headline: "WE'RE HERE\nTO HELP.",
  subline: "Seriously — our support team is made up of art lovers who care about your experience. No bots, no scripts, just real help from real people.",
  responseLabel: "Response Time",
  responseValue: "Under 24 hours",
}

const DEFAULT_CONTACT_REASONS = {
  eyebrow: "What do you need help with?",
  cards: CONTACT_REASONS.map(({ label, desc }, index) => ({ icon: ["package", "truck", "returns", "brush"][index], label, desc })),
}

const DEFAULT_SHIPPING_INFO = {
  cards: [
    {
      icon: "truck",
      title: "Shipping",
      points: [
        "Produced in 3 business days",
        "Standard: 5–8 business days",
        "Express: 2–3 business days",
        "Free on orders over $49",
        "Carbon-offset packaging",
      ],
    },
    {
      icon: "returns",
      title: "Returns",
      points: [
        "100-day no-questions return",
        "Free return label provided",
        "Full refund to original payment",
        "No need to return damaged items",
        "Exchange available",
      ],
    },
    {
      icon: "package",
      title: "Packaging",
      points: [
        "Rigid cardboard protection",
        "Corner guards on every order",
        "Damage-proof tube for large prints",
        "Fully recyclable materials",
        "Mounting kit included",
      ],
    },
  ],
}

function withFallback<T extends Record<string, unknown>>(sections: PageSection[], key: string, locale: string, fallback: T): T {
  return { ...fallback, ...(sectionContent<T>(sections, key, locale) ?? {}) }
}

function cmsIcon(name?: string, size = 20): React.ReactNode {
  switch (name) {
    case "truck": return <Truck size={size} />
    case "returns": return <RotateCcw size={size} />
    case "brush": return <Brush size={size} />
    case "clock": return <Clock size={size} />
    case "package":
    default: return <Package size={size} />
  }
}

function reasonStyle(name?: string): { color: string; bg: string } {
  switch (name) {
    case "truck": return { color: "text-dp-accent-gold", bg: "bg-dp-accent-gold/10" }
    case "returns": return { color: "text-dp-success", bg: "bg-dp-success/10" }
    case "brush": return { color: "text-dp-text-secondary", bg: "bg-dp-bg-elevated" }
    default: return { color: "text-dp-accent-cta", bg: "bg-dp-accent-cta/10" }
  }
}

// ── FAQ data ──────────────────────────────────────────────
const FAQS = [
  {
    q: "How long does shipping take?",
    a: "Standard orders take 3 business days to produce, then 5–8 days in transit. Express options are available at checkout. Tracking is emailed when your order ships.",
  },
  {
    q: "What is your return policy?",
    a: "We offer a 100-day no-questions-asked return policy. If you're not happy for any reason, contact us and we'll arrange a free return and full refund.",
  },
  {
    q: "How does the magnetic mounting work?",
    a: "Every order includes 4 magnetic mounting pins. Press the pin into your wall, then click the metal poster onto the magnetic head. No tools, no damage, under 30 seconds.",
  },
  {
    q: "Can I order a custom size?",
    a: "Yes. Our standard sizes go up to XL (36×48 in). For larger or non-standard sizes, contact us directly — we handle custom commercial orders regularly.",
  },
  {
    q: "How do artist royalties work?",
    a: "Artists set their own royalty on top of our base price. We handle production, fulfilment, and customer service. Royalties are paid monthly with transparent reporting.",
  },
  {
    q: "Are the prints colour-accurate to my screen?",
    a: "We calibrate our printers monthly to industry ICC profiles. Metal prints tend to render darker tones with more depth than screens — we recommend requesting a swatch sample for large orders.",
  },
]

// ── Accordion ─────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-dp-border last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full py-5 text-left group"
        aria-expanded={open}
      >
        <span className="text-[14px] font-bold text-dp-text-primary group-hover:text-dp-accent-cta transition-colors pr-4">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-dp-accent-cta shrink-0" />
          : <ChevronDown size={16} className="text-dp-text-tertiary shrink-0" />}
      </button>
      {open && (
        <p className="pb-5 text-[13px] text-dp-text-secondary leading-relaxed">{a}</p>
      )}
    </div>
  )
}

// ── Contact form ──────────────────────────────────────────
const CONTACT_UI: Record<string, Record<string, string>> = {
  en: {
    help: "What can we help with?", topic: "Select a topic...", first: "First Name", last: "Last Name",
    email: "Email Address", order: "Order Number (optional)", message: "Message",
    messagePlaceholder: "Tell us as much as you can - the more detail, the faster we can help.",
    attach: "Attach Image (optional, max 5 MB)", choose: "Choose image...", remove: "Remove",
    send: "Send Message", sending: "Sending...", reply: "We typically reply within 24 hours on business days.",
    sent: "Message Sent!", sentBody: "Thanks for reaching out. Our team replies within 24 hours on business days.",
    another: "Send another message", quick: "Quick Links", return: "Start a Return",
    shipping: "Shipping Guide", artist: "Artist Resources",
    topicOrder: "Order Issue", topicShipping: "Shipping & Tracking", topicReturns: "Returns & Refunds",
    topicArtist: "Artist Support", topicGeneral: "General Enquiry", topicPress: "Press & Partnerships",
  },
  ka: {
    help: "რაში შეგვიძლია დაგეხმაროთ?", topic: "აირჩიეთ თემა...", first: "სახელი", last: "გვარი",
    email: "ელფოსტა", order: "შეკვეთის ნომერი (არასავალდებულო)", message: "შეტყობინება",
    messagePlaceholder: "მოგვწერეთ დეტალურად, რათა უფრო სწრაფად დაგეხმაროთ.",
    attach: "სურათის მიმაგრება (არასავალდებულო, მაქს. 5 მბ)", choose: "აირჩიეთ სურათი...", remove: "წაშლა",
    send: "შეტყობინების გაგზავნა", sending: "იგზავნება...", reply: "სამუშაო დღეებში პასუხს ჩვეულებრივ 24 საათში მიიღებთ.",
    sent: "შეტყობინება გაიგზავნა!", sentBody: "გმადლობთ, რომ მოგვწერეთ. ჩვენი გუნდი 24 საათში გიპასუხებთ.",
    another: "კიდევ ერთი შეტყობინება", quick: "სწრაფი ბმულები", return: "დაბრუნების დაწყება",
    shipping: "მიწოდების გზამკვლევი", artist: "რესურსები არტისტებისთვის",
    topicOrder: "შეკვეთის პრობლემა", topicShipping: "მიწოდება და ტრეკინგი", topicReturns: "დაბრუნება და თანხის ანაზღაურება",
    topicArtist: "არტისტების მხარდაჭერა", topicGeneral: "ზოგადი შეკითხვა", topicPress: "მედია და პარტნიორობა",
  },
  ru: {
    help: "С чем вам помочь?", topic: "Выберите тему...", first: "Имя", last: "Фамилия",
    email: "Электронная почта", order: "Номер заказа (необязательно)", message: "Сообщение",
    messagePlaceholder: "Опишите вопрос подробнее, чтобы мы могли помочь быстрее.",
    attach: "Прикрепить изображение (необязательно, до 5 МБ)", choose: "Выбрать изображение...", remove: "Удалить",
    send: "Отправить сообщение", sending: "Отправка...", reply: "В рабочие дни мы обычно отвечаем в течение 24 часов.",
    sent: "Сообщение отправлено!", sentBody: "Спасибо за обращение. Наша команда ответит в течение 24 часов.",
    another: "Отправить еще одно сообщение", quick: "Быстрые ссылки", return: "Оформить возврат",
    shipping: "Информация о доставке", artist: "Ресурсы для художников",
    topicOrder: "Проблема с заказом", topicShipping: "Доставка и отслеживание", topicReturns: "Возврат и возмещение",
    topicArtist: "Поддержка художников", topicGeneral: "Общий вопрос", topicPress: "Пресса и партнерство",
  },
}

function ContactForm({ ui }: { ui: Record<string, string> }) {
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const fnameRef = React.useRef<HTMLInputElement>(null)
  const lnameRef = React.useRef<HTMLInputElement>(null)
  const emailRef = React.useRef<HTMLInputElement>(null)
  const orderRef = React.useRef<HTMLInputElement>(null)
  const msgRef   = React.useRef<HTMLTextAreaElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      setFormError("Image must be smaller than 5 MB.")
      return
    }
    setFormError("")
    setAttachment(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setFormError("")
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const form = new FormData()
      form.append("reason", reason || "General Enquiry")
      form.append("first_name", fnameRef.current?.value ?? "")
      form.append("last_name", lnameRef.current?.value ?? "")
      form.append("email", emailRef.current?.value ?? "")
      form.append("order_number", orderRef.current?.value ?? "")
      form.append("message", msgRef.current?.value ?? "")
      if (attachment) form.append("attachment", attachment)
      const res = await fetch(`${base}/contact/`, { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(err.detail ?? "Failed to send.")
      }
      setSubmitted(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to send. Please try again.")
    } finally {
      setSending(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-dp-success/10 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-dp-success" />
        </div>
        <h3 className="font-display text-3xl text-dp-text-primary">{ui.sent}</h3>
        <p className="text-[14px] text-dp-text-secondary max-w-sm leading-relaxed">
          {ui.sentBody}
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-2 text-[12px] font-bold uppercase tracking-widest text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors"
        >
          {ui.another}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Reason select */}
      <div>
        <label htmlFor="reason" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">
          {ui.help}
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors appearance-none"
        >
          <option value="">{ui.topic}</option>
          <option value="Order Issue">{ui.topicOrder}</option>
          <option value="Shipping & Tracking">{ui.topicShipping}</option>
          <option value="Returns & Refunds">{ui.topicReturns}</option>
          <option value="Artist Support">{ui.topicArtist}</option>
          <option value="General Enquiry">{ui.topicGeneral}</option>
          <option value="Press & Partnerships">{ui.topicPress}</option>
        </select>
      </div>

      {/* Name + email */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fname" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">{ui.first} *</label>
          <input
            id="fname"
            required
            ref={fnameRef}
            placeholder="Jane"
            className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
          />
        </div>
        <div>
          <label htmlFor="lname" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">{ui.last} *</label>
          <input
            id="lname"
            required
            ref={lnameRef}
            placeholder="Doe"
            className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">{ui.email} *</label>
        <input
          id="email"
          type="email"
          required
          ref={emailRef}
          placeholder="jane@example.com"
          className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
        />
      </div>

      <div>
        <label htmlFor="order" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">{ui.order}</label>
        <input
          id="order"
          ref={orderRef}
          placeholder="e.g. ORD-7721"
          className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">{ui.message} *</label>
        <textarea
          id="message"
          required
          ref={msgRef}
          rows={5}
          placeholder={ui.messagePlaceholder}
          className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">{ui.attach}</label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-dp-border hover:border-dp-accent-cta/50 rounded-sm text-[12px] text-dp-text-tertiary hover:text-dp-text-secondary transition-colors">
            <Upload size={14} /> {attachment ? attachment.name : ui.choose}
          </button>
          {attachment && (
            <button type="button" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = "" }}
              className="text-[11px] text-red-400 hover:text-red-500">{ui.remove}</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {formError && <p className="text-[12px] text-dp-accent-cta">{formError}</p>}
      <button
        type="submit"
        disabled={sending}
        className="flex items-center justify-center gap-2 py-4 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-60 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
      >
        {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight size={14} />}
        {sending ? ui.sending : ui.send}
      </button>

      <p className="text-[11px] text-dp-text-tertiary text-center">
        {ui.reply}
      </p>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────
export default function ContactPage({ locale, initialSections }: { locale: string; initialSections: PageSection[] }) {
  const [supportEmail, setSupportEmail] = useState("support@kolekcia.com")
  const [supportPhone, setSupportPhone] = useState("")
  const [contactFaqs, setContactFaqs] = useState(FAQS)
  const ui = CONTACT_UI[locale] ?? CONTACT_UI.en
  const { sections, loaded } = usePageSections("contact", locale, initialSections)
  const hero = withFallback<Required<ContactHeroContent>>(sections, "hero", locale, DEFAULT_CONTACT_HERO)
  const reasons = withFallback<Required<ContactReasonsContent>>(sections, "reasons", locale, DEFAULT_CONTACT_REASONS)
  const formIntro = withFallback<Required<ContactFormIntroContent>>(sections, "form_intro", locale, { heading: "Send Us a Message", body: "We read every message and reply personally." })
  const sidebar = withFallback<Required<ContactSidebarContent>>(sections, "sidebar", locale, {
    promiseTitle: "Fast Replies, Always",
    promiseBody: "Our support team operates Mon–Fri 9am–6pm CET. Emails sent after hours get a reply first thing the next morning.",
    homeEyebrow: "Our Home",
    address: "Obchodná 12\n811 06 Bratislava\nSlovakia",
  })
  const faqIntro = withFallback<Required<ContactFaqIntroContent>>(sections, "faq_intro", locale, { eyebrow: "FAQ", heading: "Common Questions", body: "Answers to everything we get asked most often. Still stuck? Message us directly." })
  const shippingInfo = withFallback<Required<ContactShippingContent>>(sections, "shipping_info", locale, DEFAULT_SHIPPING_INFO)
  const bottomCta = withFallback<Required<ContactBottomCtaContent>>(sections, "bottom_cta", locale, { eyebrow: "Still Browsing?", heading: "Discover 2.5M+ Designs", body: "The perfect piece for your wall is waiting. Free shipping over $49.", cta: "Shop Now" })

  useEffect(() => {
    apiFetch<Record<string, string>>("/cms/settings/")
      .then((d) => {
        if (d.support_email) setSupportEmail(d.support_email)
        if (d.support_phone) setSupportPhone(d.support_phone)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    apiFetch<Array<{ question: string; answer: string }>>("/cms/faqs/")
      .then((data) => {
        const localized = Array.isArray(data)
          ? data.map((item) => ({ q: item.question, a: item.answer })).filter((item) => item.q && item.a)
          : []
        setContactFaqs(localized)
      })
      .catch(() => { if (locale !== "en") setContactFaqs([]) })
  }, [locale])

  if (!loaded) {
    return (
      <SiteShell>
        <div className="min-h-[60vh] bg-dp-text-primary" aria-hidden />
      </SiteShell>
    )
  }

  return (
    <SiteShell>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="bg-dp-text-primary relative overflow-hidden" aria-label="Contact hero">
        {/* Diagonal accent stripe */}
        <div
          className="absolute -right-40 top-0 w-[600px] h-full bg-dp-accent-cta/5 -skew-x-12"
          aria-hidden
        />
        <div className="relative dp-container py-20 md:py-28 flex flex-col md:flex-row items-start md:items-center gap-8 justify-between">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-5">
              <span className="w-8 h-px bg-dp-accent-cta" aria-hidden /> {hero.eyebrow}
            </p>
            <h1 className="font-display text-[64px] md:text-[90px] leading-none text-white mb-4">
              {hero.headline.split("\n").map((line, index) => (
                <React.Fragment key={`${line}-${index}`}>
                  {index === 1 ? <span className="text-dp-accent-cta">{line}</span> : line}
                  {index < hero.headline.split("\n").length - 1 && <br />}
                </React.Fragment>
              ))}
            </h1>
            <p className="text-white/65 text-[14px] leading-relaxed max-w-md">
              {hero.subline}
            </p>
          </div>
          {/* Quick contact info */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 shrink-0 w-full md:w-auto">
            {[
              { icon: <Clock size={16} />, label: hero.responseLabel, value: hero.responseValue },
              { icon: <Mail size={16} />, label: "Email", value: supportEmail },
              ...(supportPhone ? [{ icon: <Phone size={16} />, label: "Phone", value: supportPhone }] : []),
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 bg-white/5 border border-white/10 rounded-sm px-2 sm:px-4 py-2.5 sm:py-3 min-w-0 text-center sm:text-left">
                <span className="text-dp-accent-cta shrink-0">{icon}</span>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-widest truncate">{label}</p>
                  <p className="text-[10px] sm:text-[13px] font-semibold text-white truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT REASON CARDS ─────────────────────────────────── */}
      <section className="dp-container py-14" aria-label="Choose a contact reason">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-text-tertiary mb-5">{reasons.eyebrow}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {reasons.cards.map(({ icon, label, desc }) => {
            const style = reasonStyle(icon)
            return (
            <button
              key={label}
              type="button"
              className="group flex flex-col gap-3 p-5 bg-dp-bg-surface border border-dp-border rounded-sm hover:border-dp-accent-cta/50 transition-colors text-left"
            >
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-sm ${style.bg} ${style.color} group-hover:scale-110 transition-transform`}>
                {cmsIcon(icon)}
              </span>
              <div>
                <p className="text-[13px] font-bold text-dp-text-primary">{label}</p>
                <p className="text-[12px] text-dp-text-tertiary mt-0.5 leading-snug">{desc}</p>
              </div>
            </button>
            )
          })}
        </div>
      </section>

      {/* ── FORM + SIDEBAR ────────────────────────────────────────── */}
      <section className="dp-container pb-20" aria-labelledby="contact-form-heading">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14">

          {/* Form */}
          <div className="lg:col-span-3 bg-dp-bg-surface border border-dp-border rounded-sm p-8">
            <h2 id="contact-form-heading" className="font-display text-4xl text-dp-text-primary mb-2">{formIntro.heading}</h2>
            <p className="text-[13px] text-dp-text-tertiary mb-8">{formIntro.body}</p>
            <ContactForm ui={ui} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Response time promise */}
            <div className="bg-dp-text-primary rounded-sm p-6 flex items-start gap-4">
              <span className="text-dp-accent-cta shrink-0 mt-0.5">
                <Zap size={20} />
              </span>
              <div>
                <h3 className="font-display text-2xl text-white mb-1">{sidebar.promiseTitle}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">
                  {sidebar.promiseBody}
                </p>
              </div>
            </div>

            {/* Office info */}
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary mb-4">{sidebar.homeEyebrow}</p>
              <div className="flex items-start gap-3 mb-3">
                <MapPin size={15} className="text-dp-accent-cta shrink-0 mt-0.5" />
                <p className="text-[13px] text-dp-text-secondary leading-relaxed">
                  {sidebar.address.split("\n").map((line) => (
                    <React.Fragment key={line}>
                      {line}<br />
                    </React.Fragment>
                  ))}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={15} className="text-dp-accent-cta shrink-0" />
                <a href={`mailto:${supportEmail}`} className="text-[13px] text-dp-text-secondary hover:text-dp-text-primary transition-colors">
                  {supportEmail}
                </a>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
              <p className="px-5 py-3 border-b border-dp-border text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary">{ui.quick}</p>
              {[
                { label: ui.return,   href: "/account/orders", icon: <RotateCcw size={13} /> },
                { label: ui.shipping, href: "#shipping",       icon: <Truck size={13} /> },
                { label: ui.artist,   href: "/about",          icon: <Brush size={13} /> },
              ].map(({ label, href, icon }) => (
                <LocalizedLink
                  key={label}
                  href={href}
                  className="flex items-center gap-2.5 px-5 py-3 border-b border-dp-border last:border-b-0 text-[13px] text-dp-text-secondary hover:text-dp-text-primary hover:bg-dp-bg-elevated transition-colors group"
                >
                  <span className="text-dp-text-tertiary group-hover:text-dp-accent-cta transition-colors">{icon}</span>
                  {label}
                  <ArrowRight size={11} className="ml-auto text-dp-text-tertiary group-hover:text-dp-accent-cta transition-colors" />
                </LocalizedLink>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="bg-dp-bg-elevated border-y border-dp-border py-20" aria-labelledby="faq-heading">
        <div className="dp-container">
          <div className="text-center mb-12">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">{faqIntro.eyebrow}</p>
            <h2 id="faq-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary">{faqIntro.heading}</h2>
            <p className="text-[14px] text-dp-text-secondary mt-3 max-w-md mx-auto">{faqIntro.body}</p>
          </div>
          <div className="max-w-3xl mx-auto bg-dp-bg-surface border border-dp-border rounded-sm px-8 divide-dp-border">
            {contactFaqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SHIPPING & RETURNS INFO STRIP ────────────────────────── */}
      <section id="shipping" className="dp-container py-16" aria-label="Shipping and returns info">
        <div className="grid md:grid-cols-3 gap-6">
          {shippingInfo.cards.map(({ icon, title, points }) => (
            <div key={title} className="bg-dp-bg-surface border border-dp-border rounded-sm p-7">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-sm bg-dp-accent-cta/10 text-dp-accent-cta mb-4">
                {cmsIcon(icon, 22)}
              </span>
              <h3 className="font-display text-2xl text-dp-text-primary mb-3">{title}</h3>
              <ul className="flex flex-col gap-2">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-dp-success shrink-0 mt-0.5" />
                    <span className="text-[12px] text-dp-text-secondary">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
      <section className="bg-dp-text-primary py-14 text-center" aria-label="Browse shop CTA">
        <div className="dp-container">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">{bottomCta.eyebrow}</p>
          <h2 className="font-display text-5xl md:text-6xl text-white mb-4">{bottomCta.heading}</h2>
          <p className="text-white/60 text-[13px] mb-8 max-w-sm mx-auto">{bottomCta.body}</p>
          <LocalizedLink
            href="/catalog"
            className="inline-flex items-center gap-2 px-10 py-4 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
          >
            {bottomCta.cta} <ArrowRight size={14} />
          </LocalizedLink>
        </div>
      </section>

    </SiteShell>
  )
}
