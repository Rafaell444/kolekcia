"use client"

import React from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import Link from "next/link"
import LocalizedLink from "@/components/seo/LocalizedLink"
import {
  ArrowRight, Zap, Shield, Award, Palette,
  Globe2, Truck, Heart, CheckCircle2, ChevronRight,
} from "lucide-react"
import { sectionContent, type PageSection } from "@/lib/page-sections"
import { usePageSections } from "@/lib/use-page-sections"

type TimelineItem = { year: string; title: string; body: string }
type ValueCard = { icon?: string; title: string; body: string }
type TeamMember = { name: string; role: string; bio: string; img: string }
type StatItem = { num: string; label: string }

type AboutHeroContent = {
  eyebrow?: string
  headline?: string
  subline?: string
  imageUrl?: string
  primaryCta?: string
  secondaryCta?: string
  stats?: StatItem[]
}

type AboutMissionContent = {
  eyebrow?: string
  heading?: string
  paragraphs?: string[]
  checklist?: string[]
  imageUrl?: string
  stat?: string
  statLabel?: string
}

type AboutValuesContent = { eyebrow?: string; heading?: string; cards?: ValueCard[] }
type AboutTimelineContent = { eyebrow?: string; heading?: string; items?: TimelineItem[] }
type AboutTeamContent = { eyebrow?: string; heading?: string; subheading?: string; members?: TeamMember[] }
type AboutFinalCtaContent = { heading?: string; body?: string; cta?: string }

const TIMELINE = [
  { year: "2018", title: "The Idea", body: "Founded in a Bratislava studio apartment with a single printer, a dream, and zero budget." },
  { year: "2019", title: "First 1,000 Artists", body: "Word spread through online communities. Our first big artist cohort joined within 6 months." },
  { year: "2021", title: "Magnetic Mounting", body: "We invented our tool-free magnetic pin system — now shipped with every single order." },
  { year: "2023", title: "2 Million Designs", body: "Crossed 2 million active designs from artists in 80+ countries. The catalogue never stops growing." },
  { year: "2025", title: "Koleqcia Platform", body: "Launched the full collector platform with auctions, loyalty tiers, and limited-edition drops." },
]

const VALUES = [
  {
    icon: <Palette size={22} />,
    title: "Art First",
    body: "Every decision starts with the artist. We set the highest royalty rates in the industry — because creators deserve to thrive.",
  },
  {
    icon: <Shield size={22} />,
    title: "Zero Compromise Quality",
    body: "We print on industrial-grade aluminium with UV-resistant inks that outlast paper or canvas by decades.",
  },
  {
    icon: <Globe2 size={22} />,
    title: "Global Community",
    body: "150K+ artists from 80+ countries. Your next favourite piece of art is waiting to be discovered.",
  },
  {
    icon: <Zap size={22} />,
    title: "Effortless Experience",
    body: "From browsing to hanging in under 30 seconds — our magnetic mounting system is genuinely magical.",
  },
  {
    icon: <Heart size={22} />,
    title: "Collector Culture",
    body: "Loyalty tiers, points-market rewards, auctions, and limited drops — we built a world that rewards passion and obsession.",
  },
  {
    icon: <Truck size={22} />,
    title: "Worldwide Delivery",
    body: "Fast, tracked shipping to 120+ countries with carbon-offset packaging on every order.",
  },
]

const TEAM = [
  {
    name: "Marta Holická",
    role: "CEO & Co-Founder",
    bio: "Former brand director at a European fashion house. Believed art belongs on every wall, not just galleries.",
    img: "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=400&h=400&fit=crop&crop=face",
  },
  {
    name: "Dominik Novák",
    role: "CTO & Co-Founder",
    bio: "Built the original printing pipeline in his garage. Still writes code every day.",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  },
  {
    name: "Yuki Tanaka",
    role: "Head of Artist Relations",
    bio: "Artist herself with 24K followers. Represents the community inside the company.",
    img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
  },
  {
    name: "Lucas Ferreira",
    role: "Head of Product",
    bio: "Previously built collector platforms for music and trading cards. Obsessive about UX details.",
    img: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop&crop=face",
  },
]

const DEFAULT_HERO: Required<AboutHeroContent> = {
  eyebrow: "Our Story",
  headline: "ART FOR\nEVERY\nWALL.",
  subline: "We started Koleqcia because we believed the best art in the world shouldn't live behind museum glass. It should hang in your bedroom, your studio, your office — everywhere you spend your life.",
  imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1440&h=800&fit=crop",
  primaryCta: "Explore the Shop",
  secondaryCta: "Meet the Team",
  stats: [
    { num: "2.5M+",  label: "Unique Designs" },
    { num: "150K+",  label: "Independent Artists" },
    { num: "180K+",  label: "Happy Collectors" },
    { num: "80+",    label: "Countries Served" },
  ],
}

const DEFAULT_MISSION: Required<AboutMissionContent> = {
  eyebrow: "Our Mission",
  heading: "We Exist to Champion Independent Artists.",
  paragraphs: [
    "The art market has always been controlled by galleries, agents, and institutions. We believe that's wrong. An artist in Manila or Kraków deserves the same global reach as one in New York or London.",
    "Koleqcia takes zero upfront fees from artists. We print, ship, and handle everything — they simply upload their work and earn. Our royalty rates are the highest in the industry.",
    "And when collectors bring home a piece, they're not just decorating a room — they're directly supporting a real person's creative career.",
  ],
  checklist: [
    "Highest artist royalties in the industry",
    "Zero upfront cost to list your designs",
    "Printed, shipped and handled — all by us",
  ],
  imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=1000&fit=crop",
  stat: "40%",
  statLabel: "Average artist royalty rate",
}

function withFallback<T extends Record<string, unknown>>(sections: PageSection[], key: string, locale: string, fallback: T): T {
  return { ...fallback, ...(sectionContent<T>(sections, key, locale) ?? {}) }
}

function valueIcon(name?: string): React.ReactNode {
  const props = { size: 22 }
  switch (name) {
    case "shield": return <Shield {...props} />
    case "globe": return <Globe2 {...props} />
    case "zap": return <Zap {...props} />
    case "heart": return <Heart {...props} />
    case "truck": return <Truck {...props} />
    case "award": return <Award {...props} />
    case "palette":
    default: return <Palette {...props} />
  }
}

export default function AboutPage({ locale, initialSections }: { locale: string; initialSections: PageSection[] }): React.ReactElement {
  const { sections, loaded } = usePageSections("about", locale, initialSections)
  const hero = withFallback(sections, "hero", locale, DEFAULT_HERO)
  const mission = withFallback(sections, "mission", locale, DEFAULT_MISSION)
  const values = withFallback<Required<AboutValuesContent>>(sections, "values", locale, {
    eyebrow: "What We Stand For",
    heading: "Our Values",
    cards: VALUES.map(({ title, body }, index) => ({ icon: ["palette", "shield", "globe", "zap", "heart", "truck"][index], title, body })),
  })
  const timelineSection = withFallback(sections, "timeline", locale, { eyebrow: "Our Journey", heading: "How We Got Here", items: TIMELINE })
  const team = withFallback(sections, "team", locale, { eyebrow: "The People", heading: "Meet the Team", subheading: "A small crew of artists, engineers and collectors — united by a belief that art should be for everyone.", members: TEAM })
  const finalCta = withFallback(sections, "final_cta", locale, { heading: "Ready to Transform Your Space?", body: "Over 2.5 million designs waiting for your walls. Free shipping over $49.", cta: "Browse the Shop" })

  if (!loaded) {
    return (
      <SiteShell>
        <div className="min-h-[70vh] bg-dp-text-primary" aria-hidden />
      </SiteShell>
    )
  }

  return (
    <SiteShell>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-dp-text-primary" aria-label="About hero">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src={hero.imageUrl}
            alt=""
            fill
            className="object-cover opacity-20"
            sizes="100vw"
            priority
          />
        </div>
        {/* Vertical rule */}
        <div className="absolute left-[48px] top-0 bottom-0 w-px bg-white/10 hidden lg:block" aria-hidden />

        <div className="relative dp-container py-24 md:py-36">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-6">
              <span className="w-8 h-px bg-dp-accent-cta inline-block" aria-hidden /> {hero.eyebrow}
            </p>
            <h1 className="font-display text-[72px] md:text-[100px] lg:text-[130px] leading-none text-white mb-6">
              {hero.headline.split("\n").map((line, index) => (
                <React.Fragment key={`${line}-${index}`}>
                  {index === 1 ? <span className="text-dp-accent-cta">{line}</span> : line}
                  {index < hero.headline.split("\n").length - 1 && <br />}
                </React.Fragment>
              ))}
            </h1>
            <p className="text-white/70 text-[16px] leading-relaxed max-w-lg mb-10">
              {hero.subline}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <LocalizedLink
                href="/catalog"
                className="inline-flex items-center gap-2 px-8 py-4 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
              >
                {hero.primaryCta} <ArrowRight size={14} />
              </LocalizedLink>
              <Link
                href="#team"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 hover:border-white/60 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors"
              >
                {hero.secondaryCta} <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Stat bar */}
        <div className="relative border-t border-white/10">
          <div className="dp-container">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
              {hero.stats.map(({ num, label }) => (
                <div key={label} className="py-8 px-6 first:pl-0 last:pr-0 text-center">
                  <p className="font-display text-5xl text-dp-accent-cta">{num}</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-widest mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MISSION ──────────────────────────────────────────────── */}
      <section id="mission" className="dp-container py-20 md:py-28" aria-labelledby="mission-heading">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-4">{mission.eyebrow}</p>
            <h2 id="mission-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary mb-6 leading-tight">
              {mission.heading}
            </h2>
            <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
              {mission.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <div className="mt-8 flex flex-col gap-3">
              {mission.checklist.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-dp-accent-cta shrink-0 mt-0.5" />
                  <p className="text-[13px] text-dp-text-secondary">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] relative rounded-sm overflow-hidden">
              <Image
                src={mission.imageUrl}
                alt="Artist creating digital art"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            {/* Floating accent card */}
            <div className="absolute -bottom-6 -left-6 bg-dp-text-primary text-white px-6 py-4 rounded-sm shadow-lg max-w-[180px]">
              <p className="font-display text-3xl text-dp-accent-cta">{mission.stat}</p>
              <p className="text-[11px] text-white/70 uppercase tracking-widest mt-0.5 leading-tight">{mission.statLabel}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────── */}
      <section className="bg-dp-bg-elevated border-y border-dp-border py-20" aria-labelledby="values-heading">
        <div className="dp-container">
          <div className="text-center mb-12">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">{values.eyebrow}</p>
            <h2 id="values-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary">{values.heading}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {values.cards.map(({ icon, title, body }) => (
              <div
                key={title}
                className="group bg-dp-bg-surface border border-dp-border rounded-sm p-7 hover:border-dp-accent-cta/50 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-sm bg-dp-accent-cta/10 text-dp-accent-cta mb-4 group-hover:bg-dp-accent-cta group-hover:text-white transition-colors">
                  {valueIcon(icon)}
                </span>
                <h3 className="font-display text-2xl text-dp-text-primary mb-2">{title}</h3>
                <p className="text-[13px] text-dp-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────── */}
      <section className="dp-container py-20 md:py-28" aria-labelledby="timeline-heading">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">{timelineSection.eyebrow}</p>
          <h2 id="timeline-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary">{timelineSection.heading}</h2>
        </div>
        <div className="relative max-w-3xl mx-auto">
          {/* Vertical line */}
          <div className="absolute left-[calc(50%-0.5px)] top-0 bottom-0 w-px bg-dp-border hidden md:block" aria-hidden />
          <div className="flex flex-col gap-0">
            {timelineSection.items.map((item, i) => (
              <div
                key={item.year}
                className={`relative flex md:items-center gap-6 md:gap-0 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
              >
                {/* Content */}
                <div className={`md:w-[calc(50%-2.5rem)] ${i % 2 === 0 ? "md:pr-8 md:text-right" : "md:pl-8"}`}>
                  <div className={`bg-dp-bg-surface border border-dp-border rounded-sm p-5 mb-8 md:mb-0 hover:border-dp-accent-cta/40 transition-colors`}>
                    <p className="text-[11px] font-black uppercase tracking-widest text-dp-accent-cta mb-1">{item.year}</p>
                    <h3 className="font-display text-2xl text-dp-text-primary mb-1">{item.title}</h3>
                    <p className="text-[13px] text-dp-text-secondary leading-relaxed">{item.body}</p>
                  </div>
                </div>
                {/* Dot */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-dp-accent-cta border-4 border-dp-bg-base shrink-0 z-10" aria-hidden />
                {/* Spacer */}
                <div className="hidden md:block md:w-[calc(50%-2.5rem)]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEAM ─────────────────────────────────────────────────── */}
      <section id="team" className="bg-dp-text-primary py-20 md:py-28" aria-labelledby="team-heading">
        <div className="dp-container">
          <div className="text-center mb-12">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">{team.eyebrow}</p>
            <h2 id="team-heading" className="font-display text-5xl md:text-6xl text-white">{team.heading}</h2>
            <p className="text-white/60 text-[14px] mt-3 max-w-md mx-auto">{team.subheading}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.members.map(({ name, role, bio, img }) => (
              <div key={name} className="group flex flex-col">
                <div className="relative aspect-square rounded-sm overflow-hidden bg-white/5 mb-4">
                  <Image
                    src={img}
                    alt={name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105 grayscale group-hover:grayscale-0"
                    sizes="(max-width: 640px) 100vw, 25vw"
                  />
                  {/* Red overlay on hover */}
                  <div className="absolute inset-0 bg-dp-accent-cta/0 group-hover:bg-dp-accent-cta/10 transition-colors duration-300" />
                </div>
                <p className="font-display text-2xl text-white">{name}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-dp-accent-cta mt-0.5 mb-2">{role}</p>
                <p className="text-[12px] text-white/60 leading-relaxed">{bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="bg-dp-accent-cta py-16 text-center" aria-label="Shop call to action">
        <div className="dp-container">
          <h2 className="font-display text-5xl md:text-7xl text-white mb-4">{finalCta.heading}</h2>
          <p className="text-white/80 text-[14px] mb-8 max-w-md mx-auto">{finalCta.body}</p>
          <LocalizedLink href="/catalog" className="inline-flex items-center gap-2 px-10 py-4 bg-white text-dp-accent-cta text-[13px] font-black uppercase tracking-widest rounded-sm hover:bg-dp-bg-elevated transition-colors">
            {finalCta.cta} <ArrowRight size={15} />
          </LocalizedLink>
        </div>
      </section>

    </SiteShell>
  )
}
