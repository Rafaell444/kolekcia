const DELIVERY_LABELS: Record<string, string> = {
  standard: "Standard delivery",
  fast: "Fast delivery",
  express: "Express delivery",
}

export function deliveryTypeLabel(slug: string | undefined | null): string {
  if (!slug) return DELIVERY_LABELS.standard
  return DELIVERY_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}
