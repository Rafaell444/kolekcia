import { notFound } from "next/navigation"
import ProductDetail from "./ProductDetail"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
  const res = await fetch(`${apiUrl}/products/${slug}/`, { next: { revalidate: 60 } }).catch(() => null)
  if (!res || !res.ok) notFound()
  const product = await res.json()
  return <ProductDetail product={product} />
}
