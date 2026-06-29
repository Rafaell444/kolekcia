import React from "react"
import Image from "next/image"
import Link from "next/link"
import { CheckCircle, ArrowRight } from "lucide-react"

import { parseList, type PaginatedResponse } from "@/lib/api"

type Artist = {
  id: number; name: string; handle: string; avatar_url: string
  verified: boolean; level: number; badge: string
}

async function getArtists(): Promise<Artist[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  try {
    const res = await fetch(`${apiUrl}/products/artists/?page_size=6`, { next: { revalidate: 600 } })
    if (!res.ok) return []
    return parseList(await res.json() as Artist[] | PaginatedResponse<Artist>)
  } catch {
    return []
  }
}

export default async function TrendingArtists(): Promise<React.ReactElement> {
  const artists = await getArtists()

  if (artists.length === 0) return <></>

  return (
    <section className="dp-container pb-14" aria-labelledby="artists-heading">
      <div className="flex items-end justify-between mb-6">
        <h2 className="font-display text-3xl md:text-4xl text-dp-text-primary" id="artists-heading">Top Artists</h2>
        <Link href="/catalog?sort=artist" className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary hover:text-dp-text-primary transition-colors">
          All Artists <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {artists.map((artist) => (
          <Link key={artist.id} href={`/artists/${artist.handle}`}
            className="group flex flex-col items-center gap-3 p-4 bg-dp-bg-surface border border-dp-border rounded-sm dp-card-hover text-center">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-dp-border group-hover:border-dp-accent-cta transition-colors">
              {artist.avatar_url && <Image src={artist.avatar_url} alt={artist.name} fill className="object-cover" sizes="64px" />}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-dp-text-primary flex items-center justify-center gap-1 leading-tight">
                {artist.name}
                {artist.verified && <CheckCircle size={11} className="text-dp-success shrink-0" aria-label="Verified artist" />}
              </p>
              <p className="text-[10px] text-dp-text-tertiary mt-0.5">@{artist.handle}</p>
            </div>
            <div className="flex flex-col gap-0.5 w-full pt-2 border-t border-dp-border">
              <p className="text-[11px] text-dp-text-secondary">Level <span className="font-bold text-dp-text-primary">{artist.level}</span></p>
            </div>
            {artist.badge && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border border-dp-border text-dp-text-tertiary">{artist.badge}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
