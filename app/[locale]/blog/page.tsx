import type { Metadata } from "next"
import LocalizedLink from "@/components/seo/LocalizedLink"
import { type Locale } from "@/lib/i18n"
import { BLOG_SEO } from "@/lib/seo-metadata"
import { buildPageMetadata } from "@/lib/seo"
import SiteShell from "@/components/layout/SiteShell"

// Published posts must appear immediately after an admin enables them.
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const seo = BLOG_SEO[(locale as Locale) ?? "en"] ?? BLOG_SEO.en

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/blog",
    locale,
  })
}

type BlogPost = {
  id: number
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  published_at: string
}

async function getPosts(locale: string): Promise<BlogPost[]> {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api").replace(/\/$/, "")
  try {
    const res = await fetch(`${apiUrl}/blog/?lang=${locale}`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json() as BlogPost[] | { results?: BlogPost[] }
    return Array.isArray(data) ? data : (data.results ?? [])
  } catch {
    return []
  }
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const labels = {
    en: { home: "Home", blog: "Blog", intro: "Stories, tips, and updates from the Koleqcia team.", empty: "No blog posts published yet." },
    ka: { home: "მთავარი", blog: "ბლოგი", intro: "ისტორიები, რჩევები და სიახლეები Koleqcia-ს გუნდისგან.", empty: "გამოქვეყნებული ბლოგპოსტები ჯერ არ არის." },
    ru: { home: "Главная", blog: "Блог", intro: "Истории, советы и новости от команды Koleqcia.", empty: "Опубликованных статей пока нет." },
  }[locale === "ka" || locale === "ru" ? locale : "en"]
  const posts = await getPosts(locale)

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <nav className="flex items-center gap-2 text-[12px] text-dp-text-tertiary mb-6" aria-label="Breadcrumb">
          <LocalizedLink href="/" className="hover:text-dp-text-primary transition-colors">{labels.home}</LocalizedLink>
          <span>/</span>
          <span className="text-dp-text-secondary">{labels.blog}</span>
        </nav>
        <h1 className="font-display text-5xl text-dp-text-primary">{labels.blog}</h1>
        <p className="text-dp-text-secondary mt-2">{labels.intro}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          {posts.map((post) => (
            <LocalizedLink key={post.id} href={`/blog/${post.slug}`} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden hover:border-dp-border-hover transition-colors">
              {post.cover_image_url && (
                <div className="aspect-[16/9] overflow-hidden bg-dp-bg-elevated">
                  <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}
              <div className="p-5">
                <p className="text-[11px] text-dp-text-tertiary">{new Date(post.published_at).toLocaleDateString()}</p>
                <h2 className="font-display text-2xl text-dp-text-primary mt-2">{post.title}</h2>
                <p className="text-[13px] text-dp-text-secondary mt-2 line-clamp-3">{post.excerpt}</p>
              </div>
            </LocalizedLink>
          ))}
          {posts.length === 0 && (
            <p className="text-dp-text-tertiary">{labels.empty}</p>
          )}
        </div>
      </div>
    </SiteShell>
  )
}
