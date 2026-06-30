export function productHref(product: { id: number | string; slug?: string | null; categorySlug?: string | null }): string {
  const slug = (product.slug ?? "").trim()
  if (!slug) return "/catalog"
  return `/catalog/${slug}`
}

export function productLookupFromPathParam(param: string): string {
  return param.trim()
}
