"use client"

import React, { useState, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import { apiFetch } from "@/lib/api"
import LocalizedLink from "@/components/seo/LocalizedLink"
import {
  Mail, Phone, MapPin, Package,
  RotateCcw, Truck, Brush, ArrowRight, ChevronDown,
  ChevronUp, CheckCircle2, Clock, Zap, Upload,
} from "lucide-react"

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
function ContactForm() {
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
        <h3 className="font-display text-3xl text-dp-text-primary">Message Sent!</h3>
        <p className="text-[14px] text-dp-text-secondary max-w-sm leading-relaxed">
          Thanks for reaching out. Our team replies within 24 hours on business days.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-2 text-[12px] font-bold uppercase tracking-widest text-dp-accent-cta hover:text-dp-accent-cta-hover transition-colors"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Reason select */}
      <div>
        <label htmlFor="reason" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">
          What can we help with?
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary focus:outline-none focus:border-dp-border-hover transition-colors appearance-none"
        >
          <option value="">Select a topic…</option>
          <option>Order Issue</option>
          <option>Shipping & Tracking</option>
          <option>Returns & Refunds</option>
          <option>Artist Support</option>
          <option>General Enquiry</option>
          <option>Press & Partnerships</option>
        </select>
      </div>

      {/* Name + email */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fname" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">First Name *</label>
          <input
            id="fname"
            required
            ref={fnameRef}
            placeholder="Jane"
            className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
          />
        </div>
        <div>
          <label htmlFor="lname" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">Last Name *</label>
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
        <label htmlFor="email" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">Email Address *</label>
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
        <label htmlFor="order" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">Order Number (optional)</label>
        <input
          id="order"
          ref={orderRef}
          placeholder="e.g. ORD-7721"
          className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">Message *</label>
        <textarea
          id="message"
          required
          ref={msgRef}
          rows={5}
          placeholder="Tell us as much as you can — the more detail, the faster we can help."
          className="w-full px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-border-hover transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-[11px] font-black uppercase tracking-[0.16em] text-dp-text-tertiary mb-2">Attach Image <span className="font-normal normal-case tracking-normal">(optional, max 5 MB)</span></label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-dp-border hover:border-dp-accent-cta/50 rounded-sm text-[12px] text-dp-text-tertiary hover:text-dp-text-secondary transition-colors">
            <Upload size={14} /> {attachment ? attachment.name : "Choose image…"}
          </button>
          {attachment && (
            <button type="button" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = "" }}
              className="text-[11px] text-red-400 hover:text-red-500">Remove</button>
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
        {sending ? "Sending…" : "Send Message"}
      </button>

      <p className="text-[11px] text-dp-text-tertiary text-center">
        We typically reply within <strong className="text-dp-text-secondary">24 hours</strong> on business days.
      </p>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────
export default function ContactPage() {
  const [supportEmail, setSupportEmail] = useState("support@kolekcia.com")
  const [supportPhone, setSupportPhone] = useState("")

  useEffect(() => {
    apiFetch<Record<string, string>>("/cms/settings/")
      .then((d) => {
        if (d.support_email) setSupportEmail(d.support_email)
        if (d.support_phone) setSupportPhone(d.support_phone)
      })
      .catch(() => {})
  }, [])

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
              <span className="w-8 h-px bg-dp-accent-cta" aria-hidden /> Get in Touch
            </p>
            <h1 className="font-display text-[64px] md:text-[90px] leading-none text-white mb-4">
              WE&apos;RE HERE<br />
              TO <span className="text-dp-accent-cta">HELP.</span>
            </h1>
            <p className="text-white/65 text-[14px] leading-relaxed max-w-md">
              Seriously — our support team is made up of art lovers who care about your experience.
              No bots, no scripts, just real help from real people.
            </p>
          </div>
          {/* Quick contact info */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 shrink-0 w-full md:w-auto">
            {[
              { icon: <Clock size={16} />, label: "Response Time", value: "Under 24 hours" },
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
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-text-tertiary mb-5">What do you need help with?</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CONTACT_REASONS.map(({ icon, label, desc, color, bg }) => (
            <button
              key={label}
              type="button"
              className="group flex flex-col gap-3 p-5 bg-dp-bg-surface border border-dp-border rounded-sm hover:border-dp-accent-cta/50 transition-colors text-left"
            >
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-sm ${bg} ${color} group-hover:scale-110 transition-transform`}>
                {icon}
              </span>
              <div>
                <p className="text-[13px] font-bold text-dp-text-primary">{label}</p>
                <p className="text-[12px] text-dp-text-tertiary mt-0.5 leading-snug">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── FORM + SIDEBAR ────────────────────────────────────────── */}
      <section className="dp-container pb-20" aria-labelledby="contact-form-heading">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14">

          {/* Form */}
          <div className="lg:col-span-3 bg-dp-bg-surface border border-dp-border rounded-sm p-8">
            <h2 id="contact-form-heading" className="font-display text-4xl text-dp-text-primary mb-2">Send Us a Message</h2>
            <p className="text-[13px] text-dp-text-tertiary mb-8">We read every message and reply personally.</p>
            <ContactForm />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Response time promise */}
            <div className="bg-dp-text-primary rounded-sm p-6 flex items-start gap-4">
              <span className="text-dp-accent-cta shrink-0 mt-0.5">
                <Zap size={20} />
              </span>
              <div>
                <h3 className="font-display text-2xl text-white mb-1">Fast Replies, Always</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">
                  Our support team operates Mon–Fri 9am–6pm CET. Emails sent after hours get a reply first thing the next morning.
                </p>
              </div>
            </div>

            {/* Office info */}
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary mb-4">Our Home</p>
              <div className="flex items-start gap-3 mb-3">
                <MapPin size={15} className="text-dp-accent-cta shrink-0 mt-0.5" />
                <p className="text-[13px] text-dp-text-secondary leading-relaxed">
                  Obchodná 12<br />
                  811 06 Bratislava<br />
                  Slovakia
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
              <p className="px-5 py-3 border-b border-dp-border text-[10px] font-black uppercase tracking-[0.18em] text-dp-text-tertiary">Quick Links</p>
              {[
                { label: "Start a Return",    href: "/account/orders", icon: <RotateCcw size={13} /> },
                { label: "Shipping Guide",    href: "#shipping",        icon: <Truck     size={13} /> },
                { label: "Artist Resources",  href: "/about",           icon: <Brush     size={13} /> },
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
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">FAQ</p>
            <h2 id="faq-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary">Common Questions</h2>
            <p className="text-[14px] text-dp-text-secondary mt-3 max-w-md mx-auto">Answers to everything we get asked most often. Still stuck? Message us directly.</p>
          </div>
          <div className="max-w-3xl mx-auto bg-dp-bg-surface border border-dp-border rounded-sm px-8 divide-dp-border">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SHIPPING & RETURNS INFO STRIP ────────────────────────── */}
      <section id="shipping" className="dp-container py-16" aria-label="Shipping and returns info">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Truck size={22} />,
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
              icon: <RotateCcw size={22} />,
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
              icon: <Package size={22} />,
              title: "Packaging",
              points: [
                "Rigid cardboard protection",
                "Corner guards on every order",
                "Damage-proof tube for large prints",
                "Fully recyclable materials",
                "Mounting kit included",
              ],
            },
          ].map(({ icon, title, points }) => (
            <div key={title} className="bg-dp-bg-surface border border-dp-border rounded-sm p-7">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-sm bg-dp-accent-cta/10 text-dp-accent-cta mb-4">
                {icon}
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
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">Still Browsing?</p>
          <h2 className="font-display text-5xl md:text-6xl text-white mb-4">Discover 2.5M+ Designs</h2>
          <p className="text-white/60 text-[13px] mb-8 max-w-sm mx-auto">The perfect piece for your wall is waiting. Free shipping over $49.</p>
          <LocalizedLink
            href="/catalog"
            className="inline-flex items-center gap-2 px-10 py-4 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
          >
            Shop Now <ArrowRight size={14} />
          </LocalizedLink>
        </div>
      </section>

    </SiteShell>
  )
}
