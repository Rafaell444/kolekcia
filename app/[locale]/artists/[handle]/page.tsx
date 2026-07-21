import { redirect } from "next/navigation"
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n"

const HANDLE_TO_CATEGORY: Record<string, string> = {
  ryo_tanabe: "figures",
  alex_tanaka: "wallpanels",
  "figure-studio": "figures",
  "panel-studio": "wallpanels",
}

export default async function ArtistProfileRedirect({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>
}) {
  const { locale: rawLocale, handle } = await params
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const category = HANDLE_TO_CATEGORY[handle.toLowerCase()]

  if (category) {
    redirect(`/${locale}/catalog?category=${category}`)
  }

  redirect(`/${locale}/artists`)
}
