import SiteShell from "@/components/layout/SiteShell"

export default function CookiesPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Cookie Policy</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="space-y-4 text-[14px] text-dp-text-secondary leading-relaxed">
          <p>Kolekcia uses cookies and similar technologies to keep you signed in, remember preferences, and analyze site usage.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Essential Cookies</h2>
          <p>Required for authentication, cart, and checkout. These cannot be disabled.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Preference Cookies</h2>
          <p>Store your language and currency selections for a better experience.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Managing Cookies</h2>
          <p>You can control cookies through your browser settings. Disabling essential cookies may limit site functionality.</p>
        </div>
      </div>
    </SiteShell>
  )
}
