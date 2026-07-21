import Link from "next/link"
import { DEFAULT_LOCALE } from "@/lib/i18n"

export default function RootNotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-display text-6xl text-dp-text-primary tracking-wider mb-2">404</p>
      <h1 className="font-display text-3xl text-dp-text-primary mb-3">Page not found</h1>
      <p className="text-[14px] text-dp-text-secondary max-w-md mb-8">
        This page does not exist. Return to Koleqcia to continue browsing.
      </p>
      <Link
        href={`/${DEFAULT_LOCALE}`}
        className="inline-flex items-center justify-center px-8 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
      >
        Go to Koleqcia
      </Link>
    </main>
  )
}
