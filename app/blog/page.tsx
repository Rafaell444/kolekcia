import Link from "next/link"
import SiteShell from "@/components/layout/SiteShell"

type BlogPost = {
  id: number
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  published_at: string
}

async function getPosts(): Promise<BlogPost[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  try {
    const res = await fetch(`${apiUrl}/blog/`, { next: { revalidate: 120 } })
    if (!res.ok) return []
    return (await res.json()) as BlogPost[]
  } catch {
    return []
  }
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <SiteShell>
      <div className="dp-container py-12">
        <h1 className="font-display text-5xl text-dp-text-primary">Blog</h1>
        <p className="text-dp-text-secondary mt-2">Stories, tips, and updates from the Kolekcia team.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden hover:border-dp-border-hover transition-colors">
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
            </Link>
          ))}
          {posts.length === 0 && (
            <p className="text-dp-text-tertiary">No blog posts published yet.</p>
          )}
        </div>
      </div>
    </SiteShell>
  )
}
