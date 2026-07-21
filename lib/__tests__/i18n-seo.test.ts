import { describe, expect, it } from "vitest"
import {
  DEFAULT_LOCALE,
  getLocaleFromPath,
  isValidLocale,
  localizedPath,
  stripLocalePrefix,
} from "../i18n"
import { SITE_URL, buildAlternates, buildPageMetadata } from "../seo"

describe("i18n", () => {
  it("validates locales", () => {
    expect(isValidLocale("en")).toBe(true)
    expect(isValidLocale("ka")).toBe(true)
    expect(isValidLocale("ru")).toBe(true)
    expect(isValidLocale("de")).toBe(false)
  })

  it("builds localized paths", () => {
    expect(localizedPath("/catalog", "ka")).toBe("/ka/catalog")
    expect(localizedPath("catalog", "en")).toBe("/en/catalog")
    expect(localizedPath("/en/catalog", "ru")).toBe("/ru/catalog")
  })

  it("strips and detects locale prefixes", () => {
    expect(stripLocalePrefix("/ka/blog/hello")).toBe("/blog/hello")
    expect(stripLocalePrefix("/catalog")).toBe("/catalog")
    expect(getLocaleFromPath("/ru/about")).toBe("ru")
    expect(getLocaleFromPath("/about")).toBe(DEFAULT_LOCALE)
  })
})

describe("seo", () => {
  it("builds alternates with x-default", () => {
    const alt = buildAlternates("/catalog", "en")
    expect(alt.canonical).toBe(`${SITE_URL}/en/catalog`)
    expect(alt.languages.en).toBe(`${SITE_URL}/en/catalog`)
    expect(alt.languages.ka).toBe(`${SITE_URL}/ka/catalog`)
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/en/catalog`)
  })

  it("builds page metadata with og:url and default og image", () => {
    const meta = buildPageMetadata({
      title: "Shop | Koleqcia",
      description: "Browse",
      path: "/catalog",
      locale: "en",
    })
    expect(meta.title).toBe("Shop")
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/en/catalog`)
    expect(meta.openGraph?.url).toBe(`${SITE_URL}/en/catalog`)
    expect(meta.openGraph?.images).toBeDefined()
  })

  it("resolves absolute URLs", async () => {
    const { absoluteUrl } = await import("../seo")
    expect(absoluteUrl("/images/og-koleqcia.jpg")).toBe(`${SITE_URL}/images/og-koleqcia.jpg`)
    expect(absoluteUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg")
  })
})
