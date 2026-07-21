"use client"

import { useEffect } from "react"

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-24 text-center bg-dp-bg">
      <p className="font-display text-5xl md:text-6xl text-dp-text-primary tracking-wider mb-2">
        Koleqcia
      </p>
      <h1 className="font-display text-3xl text-dp-text-primary mb-3">Something went wrong</h1>
      <p className="text-[14px] text-dp-text-secondary max-w-md mb-8">
        An unexpected error occurred. You can try again, or return home.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center justify-center px-8 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
      >
        Try again
      </button>
    </main>
  )
}
