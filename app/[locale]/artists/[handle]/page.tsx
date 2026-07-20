import { redirect } from "next/navigation"

const HANDLE_TO_CATEGORY: Record<string, string> = {
  ryo_tanabe: "figures",
  alex_tanaka: "wallpanels",
  "figure-studio": "figures",
  "panel-studio": "wallpanels",
}

export default async function ArtistProfileRedirect({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const category = HANDLE_TO_CATEGORY[handle.toLowerCase()]

  if (category) {
    redirect(`/catalog?category=${category}`)
  }

  redirect("/artists")
}
