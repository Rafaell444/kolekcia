"use client"

import Link from "next/link"
import { ArrowRight, Check, Layers, Palette, Box, Package, Award, Sparkles, Shield } from "lucide-react"

type BlockItem = { title?: string; desc?: string; label?: string; detail?: string; value?: string; icon?: string }
type Block = {
  type: string
  eyebrow?: string
  heading?: string
  body?: string
  items?: BlockItem[]
  bullets?: BlockItem[]
  side_items?: BlockItem[]
  buttons?: Array<{ label: string; href: string; variant?: string }>
  dark?: boolean
}

const ICONS: Record<string, React.ReactNode> = {
  layers: <Layers size={22} />,
  palette: <Palette size={22} />,
  box: <Box size={22} />,
  package: <Package size={24} />,
  award: <Award size={24} />,
  sparkles: <Sparkles size={24} />,
  shield: <Shield size={24} />,
}

export type ProductCmsContent = { blocks?: Block[] }

export default function ProductCmsSections({ content }: { content?: ProductCmsContent | null }) {
  const blocks = content?.blocks ?? []
  if (!blocks.length) return null

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "feature_grid") {
          return (
            <section key={i} className="border-y border-dp-border bg-dp-bg-elevated py-14" aria-labelledby={`cms-block-${i}`}>
              <div className="dp-container">
                <div className="max-w-2xl mx-auto text-center mb-10">
                  {block.eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">{block.eyebrow}</p>}
                  {block.heading && <h2 id={`cms-block-${i}`} className="font-display text-4xl md:text-5xl text-dp-text-primary mb-4 leading-tight whitespace-pre-line">{block.heading}</h2>}
                  {block.body && <p className="text-[14px] text-dp-text-secondary leading-relaxed">{block.body}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(block.items ?? []).map((item) => (
                    <div key={item.title} className="p-6 bg-dp-bg-surface border border-dp-border rounded-sm">
                      {item.icon && <span className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-dp-accent-cta/10 text-dp-accent-cta mb-4">{ICONS[item.icon] ?? <Layers size={22} />}</span>}
                      <h3 className="text-[15px] font-bold text-dp-text-primary mb-2">{item.title}</h3>
                      <p className="text-[13px] text-dp-text-secondary leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        }

        if (block.type === "split_content") {
          return (
            <section key={i} className="dp-container py-16" aria-labelledby={`cms-block-${i}`}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                  {block.eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">{block.eyebrow}</p>}
                  {block.heading && <h2 id={`cms-block-${i}`} className="font-display text-3xl md:text-4xl text-dp-text-primary mb-4 leading-tight whitespace-pre-line">{block.heading}</h2>}
                  {block.body && <p className="text-[14px] text-dp-text-secondary leading-relaxed mb-6">{block.body}</p>}
                  <div className="space-y-3">
                    {(block.bullets ?? []).map((b) => (
                      <div key={b.label} className="flex gap-3 p-4 bg-dp-bg-surface border border-dp-border rounded-sm">
                        <Check size={16} className="text-dp-success shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[13px] font-bold text-dp-text-primary">{b.label}</p>
                          <p className="text-[12px] text-dp-text-secondary mt-0.5">{b.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(block.side_items ?? []).map((item) => (
                    <div key={item.label} className="aspect-[4/5] bg-dp-bg-surface border border-dp-border rounded-sm flex flex-col items-center justify-center gap-3 p-4 text-center">
                      {item.icon && <span className="text-dp-accent-cta">{ICONS[item.icon]}</span>}
                      <p className="text-[12px] font-bold uppercase tracking-widest text-dp-text-secondary">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        }

        if (block.type === "dark_hero") {
          return (
            <section key={i} className="bg-dp-text-primary text-white py-16" aria-labelledby={`cms-block-${i}`}>
              <div className="dp-container">
                <div className="flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1">
                    {block.eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">{block.eyebrow}</p>}
                    {block.heading && <h2 id={`cms-block-${i}`} className="font-display text-4xl md:text-5xl mb-4 leading-tight text-white whitespace-pre-line">{block.heading}</h2>}
                    {block.body && <p className="text-white/70 text-[14px] leading-relaxed max-w-md mb-6">{block.body}</p>}
                    {(block.buttons ?? []).map((btn) => (
                      <Link key={btn.href} href={btn.href} className="inline-flex items-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors">
                        {btn.label} <ArrowRight size={14} />
                      </Link>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 flex-1 w-full max-w-sm">
                    {(block.items ?? []).map((item) => (
                      <div key={item.label} className="p-4 bg-white/5 border border-white/10 rounded-sm text-center">
                        <p className="font-display text-3xl text-white">{item.value}</p>
                        <p className="text-[11px] text-white/60 uppercase tracking-widest mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )
        }

        if (block.type === "cta_band") {
          return (
            <section key={i} className={`py-14 ${block.dark ? "bg-dp-text-primary text-white" : "bg-dp-bg-elevated border-y border-dp-border"}`} aria-labelledby={`cms-block-${i}`}>
              <div className="dp-container flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-xl">
                  {block.eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dp-accent-cta mb-3">{block.eyebrow}</p>}
                  {block.heading && <h2 id={`cms-block-${i}`} className={`font-display text-3xl md:text-4xl mb-4 leading-tight ${block.dark ? "text-white" : "text-dp-text-primary"}`}>{block.heading}</h2>}
                  {block.body && <p className={`text-[14px] leading-relaxed ${block.dark ? "text-white/70" : "text-dp-text-secondary"}`}>{block.body}</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  {(block.buttons ?? []).map((btn) => (
                    <Link
                      key={btn.href + btn.label}
                      href={btn.href}
                      className={btn.variant === "outline"
                        ? "inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/20 hover:border-white/40 text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
                        : "inline-flex items-center justify-center gap-2 px-6 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"}
                    >
                      {btn.label} <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )
        }

        return null
      })}
    </>
  )
}
