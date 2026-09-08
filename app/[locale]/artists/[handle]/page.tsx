import { redirect } from "next/navigation"
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n"
import CatalogPage from "@/app/[locale]/catalog/CatalogPage"

const HANDLE_TO_CATEGORY: Record<string, string> = {
  ryo_tanabe: "figures",
  alex_tanaka: "wallpanels",
  "figure-studio": "figures",
  "panel-studio": "wallpanels",
}

const VENDOR_HANDLES = new Set(["sculpi", "mangamoon"])

export default async function ArtistProfileRedirect({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>
}) {
  const { locale: rawLocale, handle } = await params
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const normalizedHandle = handle.toLowerCase()
  const category = HANDLE_TO_CATEGORY[normalizedHandle]

  if (VENDOR_HANDLES.has(normalizedHandle)) {
    return <CatalogPage vendorOverride={normalizedHandle} pathOverride={`/artists/${normalizedHandle}`} />
  }

  if (category) {
    redirect(`/${locale}/catalog?category=${category}`)
  }

  redirect(`/${locale}/artists`)
}
