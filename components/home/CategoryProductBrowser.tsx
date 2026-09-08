"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import HomeProductCard from "@/components/home/HomeProductCard"
import type { HomeProduct } from "@/components/home/HomeProductCard"

export type HomeCategoryProducts = {
  id: number
  name: string
  slug: string
  products: HomeProduct[]
}

type Props = {
  categories: HomeCategoryProducts[]
  locale: string
  heading: string
  seeAllLabel: string
}

const ROTATION_DELAY_MS = 5000
const MANUAL_ROTATION_DELAY_MS = 10000
const EXIT_DURATION_MS = 220

export default function CategoryProductBrowser({ categories, locale, heading, seeAllLabel }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [rotationReset, setRotationReset] = useState(0)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualPauseUntil = useRef(0)

  const changeTab = useCallback((nextIndex: number, isManual = false) => {
    if (isManual) {
      manualPauseUntil.current = Date.now() + MANUAL_ROTATION_DELAY_MS
      setRotationReset((value) => value + 1)
    }
    if (nextIndex === activeIndex || transitionTimer.current !== null) return
    if (autoTimer.current !== null) clearTimeout(autoTimer.current)

    setIsVisible(false)
    transitionTimer.current = setTimeout(() => {
      setActiveIndex(nextIndex)
      transitionTimer.current = null
      requestAnimationFrame(() => setIsVisible(true))
    }, EXIT_DURATION_MS)
  }, [activeIndex])

  useEffect(() => {
    if (categories.length <= 1) return
    const manualDelayRemaining = Math.max(0, manualPauseUntil.current - Date.now())
    const delay = Math.max(ROTATION_DELAY_MS, manualDelayRemaining)
    autoTimer.current = setTimeout(() => {
      changeTab((activeIndex + 1) % categories.length)
    }, delay)

    return () => {
      if (autoTimer.current !== null) clearTimeout(autoTimer.current)
      autoTimer.current = null
    }
  }, [activeIndex, categories.length, changeTab, rotationReset])

  useEffect(() => () => {
    if (transitionTimer.current !== null) clearTimeout(transitionTimer.current)
  }, [])

  if (categories.length === 0) return null

  const activeCategory = categories[activeIndex] ?? categories[0]

  return (
    <section className="dp-container pb-14" aria-labelledby="category-products-heading">
      <div className="mb-7 text-center">
        <h2
          id="category-products-heading"
          className="font-display text-3xl md:text-4xl text-dp-text-primary uppercase"
        >
          {heading}
        </h2>

        <div
          className="mt-6 flex max-w-full items-center justify-start gap-1 overflow-x-auto pb-1 sm:justify-center"
          role="tablist"
          aria-label={heading}
        >
          {categories.map((category, index) => {
            const selected = index === activeIndex
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="homepage-category-products"
                onClick={() => changeTab(index, true)}
                className={`shrink-0 border px-4 py-2 text-[12px] font-semibold transition-colors ${
                  selected
                    ? "border-dp-accent-cta text-dp-accent-cta bg-dp-bg-surface"
                    : "border-transparent text-dp-text-secondary hover:text-dp-text-primary"
                }`}
              >
                {category.name}
              </button>
            )
          })}
        </div>
      </div>

      <div
        id="homepage-category-products"
        role="tabpanel"
        aria-label={activeCategory.name}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {activeCategory.products.map((product, index) => (
            <div
              key={`${activeCategory.id}-${product.id}`}
              className={`ease-out transition-[opacity,transform] motion-reduce:transform-none motion-reduce:transition-none ${
                isVisible
                  ? "translate-y-0 scale-100 opacity-100 duration-500"
                  : "translate-y-4 scale-[0.97] opacity-0 duration-200"
              }`}
              style={{ transitionDelay: isVisible ? `${Math.min(index, 11) * 35}ms` : "0ms" }}
            >
              <HomeProductCard product={product} />
            </div>
          ))}
        </div>

        <div className={`mt-7 flex justify-center transition-opacity duration-300 motion-reduce:transition-none ${isVisible ? "opacity-100" : "opacity-0"}`}>
          <Link
            href={`/${locale}/catalog?category=${encodeURIComponent(activeCategory.slug)}`}
            aria-label={`${seeAllLabel}: ${activeCategory.name}`}
            className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-dp-text-secondary transition-colors hover:text-dp-text-primary"
          >
            {seeAllLabel}
            <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
