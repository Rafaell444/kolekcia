"use client"

import React, { useEffect, useState } from "react"
import SiteShell from "@/components/layout/SiteShell"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight, Zap, Shield, Award, Palette,
  Globe2, Truck, Heart, Star, CheckCircle2, ChevronRight, Users,
} from "lucide-react"
import { apiFetch, parseList, type PaginatedResponse } from "@/lib/api"

type Artist = { id: number; name: string; handle: string; avatar_url: string; badge: string; verified: boolean }

const TIMELINE = [
  { year: "2018", title: "The Idea", body: "Founded in a Bratislava studio apartment with a single printer, a dream, and zero budget." },
  { year: "2019", title: "First 1,000 Artists", body: "Word spread through online communities. Our first big artist cohort joined within 6 months." },
  { year: "2021", title: "Magnetic Mounting", body: "We invented our tool-free magnetic pin system — now shipped with every single order." },
  { year: "2023", title: "2 Million Designs", body: "Crossed 2 million active designs from artists in 80+ countries. The catalogue never stops growing." },
  { year: "2025", title: "Kolekcia Platform", body: "Launched the full collector platform with auctions, XP rewards, and limited-edition drops." },
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
    body: "XP rewards, auctions, badges, and limited drops — we built a world that rewards passion and obsession.",
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

const PRESS = [
  { name: "Wired",       quote: "\"The Spotify of wall art.\"" },
  { name: "TechCrunch",  quote: "\"Disrupting how we think about home decor.\"" },
  { name: "Fast Company",quote: "\"The smartest mounting system we've ever tested.\"" },
  { name: "Dezeen",      quote: "\"A marketplace with genuine taste and purpose.\"" },
]

export default function AboutPage(): React.ReactElement {
  const [artists, setArtists] = useState<Artist[]>([])
  const [timeline, setTimeline] = useState(TIMELINE)

  useEffect(() => {
    let cancelled = false
    apiFetch<Artist[] | PaginatedResponse<Artist>>("/products/artists/?page_size=6")
      .then((d) => { if (!cancelled) setArtists(parseList(d).slice(0, 6)) })
      .catch(() => {})
    apiFetch<Array<{ section_key: string; content: { items?: typeof TIMELINE } }>>("/cms/pages/about/")
      .then((sections) => {
        if (cancelled) return
        const t = sections.find((s) => s.section_key === "timeline")
        if (t?.content?.items?.length) setTimeline(t.content.items)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <SiteShell>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-dp-text-primary" aria-label="About hero">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1440&h=800&fit=crop"
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
              <span className="w-8 h-px bg-dp-accent-cta inline-block" aria-hidden /> Our Story
            </p>
            <h1 className="font-display text-[72px] md:text-[100px] lg:text-[130px] leading-none text-white mb-6">
              ART FOR<br />
              <span className="text-dp-accent-cta">EVERY</span><br />
              WALL.
            </h1>
            <p className="text-white/70 text-[16px] leading-relaxed max-w-lg mb-10">
              We started Kolekcia because we believed the best art in the world shouldn&apos;t live behind museum glass.
              It should hang in your bedroom, your studio, your office — everywhere you spend your life.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 px-8 py-4 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
              >
                Explore the Shop <ArrowRight size={14} />
              </Link>
              <Link
                href="#team"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 hover:border-white/60 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors"
              >
                Meet the Team <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Stat bar */}
        <div className="relative border-t border-white/10">
          <div className="dp-container">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
              {[
                { num: "2.5M+",  label: "Unique Designs" },
                { num: "150K+",  label: "Independent Artists" },
                { num: "180K+",  label: "Happy Collectors" },
                { num: "80+",    label: "Countries Served" },
              ].map(({ num, label }) => (
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
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-4">Our Mission</p>
            <h2 id="mission-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary mb-6 leading-tight">
              We Exist to Champion Independent Artists.
            </h2>
            <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
              <p>
                The art market has always been controlled by galleries, agents, and institutions.
                We believe that&apos;s wrong. An artist in Manila or Kraków deserves the same global reach as one in New York or London.
              </p>
              <p>
                Kolekcia takes zero upfront fees from artists. We print, ship, and handle everything — they simply upload their work and earn.
                Our royalty rates are the highest in the industry.
              </p>
              <p>
                And when collectors bring home a piece, they&apos;re not just decorating a room — they&apos;re directly supporting a real person&apos;s creative career.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              {[
                "Highest artist royalties in the industry",
                "Zero upfront cost to list your designs",
                "Printed, shipped and handled — all by us",
              ].map((item) => (
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
                src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=1000&fit=crop"
                alt="Artist creating digital art"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            {/* Floating accent card */}
            <div className="absolute -bottom-6 -left-6 bg-dp-text-primary text-white px-6 py-4 rounded-sm shadow-lg max-w-[180px]">
              <p className="font-display text-3xl text-dp-accent-cta">40%</p>
              <p className="text-[11px] text-white/70 uppercase tracking-widest mt-0.5 leading-tight">Average artist royalty rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────── */}
      <section className="bg-dp-bg-elevated border-y border-dp-border py-20" aria-labelledby="values-heading">
        <div className="dp-container">
          <div className="text-center mb-12">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">What We Stand For</p>
            <h2 id="values-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary">Our Values</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VALUES.map(({ icon, title, body }) => (
              <div
                key={title}
                className="group bg-dp-bg-surface border border-dp-border rounded-sm p-7 hover:border-dp-accent-cta/50 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-sm bg-dp-accent-cta/10 text-dp-accent-cta mb-4 group-hover:bg-dp-accent-cta group-hover:text-white transition-colors">
                  {icon}
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
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">Our Journey</p>
          <h2 id="timeline-heading" className="font-display text-5xl md:text-6xl text-dp-text-primary">How We Got Here</h2>
        </div>
        <div className="relative max-w-3xl mx-auto">
          {/* Vertical line */}
          <div className="absolute left-[calc(50%-0.5px)] top-0 bottom-0 w-px bg-dp-border hidden md:block" aria-hidden />
          <div className="flex flex-col gap-0">
            {timeline.map((item, i) => (
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
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">The People</p>
            <h2 id="team-heading" className="font-display text-5xl md:text-6xl text-white">Meet the Team</h2>
            <p className="text-white/60 text-[14px] mt-3 max-w-md mx-auto">A small crew of artists, engineers and collectors — united by a belief that art should be for everyone.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TEAM.map(({ name, role, bio, img }) => (
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

      {/* ── FEATURED ARTISTS ─────────────────────────────────────── */}
      <section className="dp-container py-20" aria-labelledby="artists-heading">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-2">The Creators</p>
            <h2 id="artists-heading" className="font-display text-5xl text-dp-text-primary">Star Artists</h2>
          </div>
          <Link href="/catalog?sort=artist" className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
            Browse All <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {artists.map((artist) => (
            <Link
              key={artist.id}
              href={`/artists/${artist.handle}`}
              className="group flex flex-col items-center gap-2 p-4 bg-dp-bg-surface border border-dp-border rounded-sm hover:border-dp-accent-cta/50 transition-colors text-center"
            >
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-dp-border group-hover:border-dp-accent-cta transition-colors">
                {artist.avatar_url && <Image src={artist.avatar_url} alt={artist.name} fill className="object-cover" sizes="64px" />}
              </div>
              <div>
                <p className="text-[12px] font-bold text-dp-text-primary group-hover:text-dp-accent-cta transition-colors leading-tight">{artist.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star size={9} className="fill-dp-accent-gold text-dp-accent-gold" />
                  <span className="text-[10px] text-dp-text-tertiary">{artist.badge}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── PRESS ────────────────────────────────────────────────── */}
      <section id="press" className="bg-dp-bg-elevated border-y border-dp-border py-14" aria-labelledby="press-heading">
        <div className="dp-container">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-dp-text-tertiary mb-8">As Seen In</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PRESS.map(({ name, quote }) => (
              <div key={name} className="bg-dp-bg-surface border border-dp-border rounded-sm px-6 py-5">
                <p className="font-display text-2xl text-dp-text-primary mb-3">{name}</p>
                <p className="text-[13px] text-dp-text-secondary italic leading-relaxed">{quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAREERS ──────────────────────────────────────────────── */}
      <section id="careers" className="dp-container py-20" aria-labelledby="careers-heading">
        <div className="bg-dp-text-primary rounded-sm overflow-hidden relative">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize: "12px 12px" }} aria-hidden />
          <div className="relative flex flex-col md:flex-row items-center gap-8 px-8 md:px-16 py-14">
            <div className="flex-1 text-center md:text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-dp-accent-cta mb-3">Join Us</p>
              <h2 id="careers-heading" className="font-display text-5xl md:text-6xl text-white leading-tight mb-4">
                We&apos;re Hiring Brilliant People.
              </h2>
              <p className="text-white/70 text-[14px] leading-relaxed max-w-md">
                Remote-first, passion-led, and growing fast. We&apos;re looking for engineers, designers, and art-lovers who want to build something that matters.
              </p>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <Link href="/contact" className="flex items-center justify-center gap-2 px-8 py-4 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
                See Open Roles <ArrowRight size={14} />
              </Link>
              <Link href="/contact" className="flex items-center justify-center gap-2 px-8 py-4 border border-white/30 hover:border-white/60 text-white text-[12px] font-bold uppercase tracking-widest rounded-sm transition-colors">
                <Users size={14} /> Send Speculative CV
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="bg-dp-accent-cta py-16 text-center" aria-label="Shop call to action">
        <div className="dp-container">
          <h2 className="font-display text-5xl md:text-7xl text-white mb-4">Ready to Transform Your Space?</h2>
          <p className="text-white/80 text-[14px] mb-8 max-w-md mx-auto">Over 2.5 million designs waiting for your walls. Free shipping over $49.</p>
          <Link href="/catalog" className="inline-flex items-center gap-2 px-10 py-4 bg-white text-dp-accent-cta text-[13px] font-black uppercase tracking-widest rounded-sm hover:bg-dp-bg-elevated transition-colors">
            Browse the Shop <ArrowRight size={15} />
          </Link>
        </div>
      </section>

    </SiteShell>
  )
}
