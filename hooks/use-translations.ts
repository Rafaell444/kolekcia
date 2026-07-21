"use client"

import { useParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "@/lib/i18n"
import { getMessages, translate, type MessageKey, type Messages } from "@/lib/messages"

export function useTranslations() {
  const params = useParams()
  const raw = (params?.locale as string) ?? DEFAULT_LOCALE
  const locale: Locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE

  const messages: Messages = useMemo(() => getMessages(locale), [locale])

  const t = useCallback(
    (key: MessageKey) => translate(messages, key),
    [messages],
  )

  return { t, locale, messages }
}
