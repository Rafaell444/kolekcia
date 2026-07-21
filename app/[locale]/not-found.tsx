import LocalizedLink from "@/components/seo/LocalizedLink"

export default function LocaleNotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-24 text-center bg-dp-bg">
      <p className="font-display text-6xl md:text-8xl text-dp-text-primary tracking-wider mb-2">404</p>
      <h1 className="font-display text-3xl md:text-4xl text-dp-text-primary mb-3">Page not found</h1>
      <p className="text-[14px] text-dp-text-secondary max-w-md mb-8">
        The page you are looking for does not exist or has been moved.
      </p>
      <LocalizedLink
        href="/"
        className="inline-flex items-center justify-center px-8 py-3 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-black uppercase tracking-widest rounded-sm transition-colors"
      >
        Back to Koleqcia
      </LocalizedLink>
    </main>
  )
}
