"use client"

import Link from "next/link"
import { useLocalizedHref } from "@/lib/use-localized-href"
import type { ComponentProps } from "react"

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string
}

export default function LocalizedLink({ href, ...props }: Props) {
  const localizedHref = useLocalizedHref(href)
  return <Link href={localizedHref} {...props} />
}
