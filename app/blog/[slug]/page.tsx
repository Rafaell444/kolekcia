import { notFound } from "next/navigation"
import SiteShell from "@/components/layout/SiteShell"

type BlogPost = {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  cover_image_url: string
  published_at: string
}

async function getPost(slug: string): Promise<BlogPost | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  try {
    const res = await fetch(`${apiUrl}/blog/${slug}/`, { next: { revalidate: 120 } })
    if (!res.ok) return null
    return (await res.json()) as BlogPost
  } catch {
    return null
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return (
    <SiteShell>
      <article className="dp-container py-12 max-w-3xl">
        <p className="text-[11px] text-dp-text-tertiary">{new Date(post.published_at).toLocaleDateString()}</p>
        <h1 className="font-display text-5xl text-dp-text-primary mt-2">{post.title}</h1>
        {post.cover_image_url && (
          <div className="mt-6 rounded-sm overflow-hidden border border-dp-border">
            <img src={post.cover_image_url} alt={post.title} className="w-full h-auto object-cover" />
          </div>
        )}
        <div className="prose prose-invert max-w-none mt-8">
          <p className="text-[15px] text-dp-text-secondary whitespace-pre-wrap leading-7">{post.content}</p>
        </div>
      </article>
    </SiteShell>
  )
}
