import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import SiteShell from "@/components/layout/SiteShell"
import Breadcrumb from "@/components/seo/Breadcrumb"
import { LOCALES } from "@/lib/i18n"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kolekcia.example.com"

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }

type BlogPost = {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  content_blocks: ContentBlock[]
  cover_image_url: string
  published_at: string
}

async function getPost(slug: string): Promise<BlogPost | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  try {
    const res = await fetch(`${apiUrl}/blog/${slug}/`, { next: { revalidate: 10 } })
    if (!res.ok) return null
    return (await res.json()) as BlogPost
  } catch {
    return null
  }
}

function renderBlocks(blocks: ContentBlock[]) {
  return blocks.map((block, i) => {
    if (block.type === "heading") {
      return (
        <h2 key={i} className="font-display text-3xl text-dp-text-primary mt-10 mb-4">
          {block.text}
        </h2>
      )
    }
    if (block.type === "paragraph") {
      return (
        <p key={i} className="text-[16px] text-dp-text-secondary leading-8 mb-6">
          {block.text}
        </p>
      )
    }
    if (block.type === "image" && block.url) {
      return (
        <figure key={i} className="my-8">
          <div className="rounded-sm overflow-hidden border border-dp-border">
            <img src={block.url} alt={block.caption || ""} className="w-full h-auto object-cover" />
          </div>
          {block.caption && <figcaption className="text-[12px] text-dp-text-tertiary mt-2 text-center">{block.caption}</figcaption>}
        </figure>
      )
    }
    if (block.type === "video" && block.url) {
      return (
        <figure key={i} className="my-8">
          <div className="rounded-sm overflow-hidden border border-dp-border aspect-video bg-black">
            <video src={block.url} controls className="w-full h-full" />
          </div>
          {block.caption && <figcaption className="text-[12px] text-dp-text-tertiary mt-2 text-center">{block.caption}</figcaption>}
        </figure>
      )
    }
    return null
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "Post Not Found" }

  const alternates: Record<string, string> = {}
  for (const loc of LOCALES) {
    alternates[loc] = `${SITE_URL}/${loc}/blog/${slug}`
  }

  return {
    title: `${post.title} | Kolekcia Blog`,
    description: post.excerpt?.slice(0, 160) || "",
    openGraph: {
      title: post.title,
      description: post.excerpt || "",
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
      locale,
      type: "article",
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}/blog/${slug}`,
      languages: alternates,
    },
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const hasBlocks = post.content_blocks && post.content_blocks.length > 0

  return (
    <SiteShell>
      <article className="dp-container py-8 max-w-3xl">
        <Breadcrumb items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
        ]} />

        <p className="text-[11px] text-dp-text-tertiary">{new Date(post.published_at).toLocaleDateString()}</p>
        <h1 className="font-display text-4xl sm:text-5xl text-dp-text-primary mt-2 leading-tight">{post.title}</h1>
        {post.excerpt && <p className="text-[15px] text-dp-text-secondary mt-4 leading-relaxed">{post.excerpt}</p>}

        {post.cover_image_url && (
          <div className="mt-8 rounded-sm overflow-hidden border border-dp-border">
            <img src={post.cover_image_url} alt={post.title} className="w-full h-auto object-cover" />
          </div>
        )}

        <div className="mt-10">
          {hasBlocks ? renderBlocks(post.content_blocks) : (
            <p className="text-[16px] text-dp-text-secondary whitespace-pre-wrap leading-8">{post.content}</p>
          )}
        </div>
      </article>
    </SiteShell>
  )
}
