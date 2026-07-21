import type { Locale } from "@/lib/i18n"
import en, { type MessageTree } from "./en"
import ka from "./ka"
import ru from "./ru"

const catalogs: Record<Locale, MessageTree> = { en, ka, ru }

export type Messages = MessageTree

/** Dot-path keys into the message tree, e.g. "nav.shop" | "home.trending" */
export type MessageKey = {
  [K1 in keyof MessageTree]: MessageTree[K1] extends Record<string, string>
    ? `${K1 & string}.${keyof MessageTree[K1] & string}`
    : never
}[keyof MessageTree]

export function getMessages(locale: string): MessageTree {
  if (locale in catalogs) return catalogs[locale as Locale]
  return en
}

export function translate(messages: MessageTree, key: MessageKey): string {
  const [group, leaf] = key.split(".") as [keyof MessageTree, string]
  const section = messages[group] as Record<string, string> | undefined
  return section?.[leaf] ?? key
}

export { en, ka, ru }
