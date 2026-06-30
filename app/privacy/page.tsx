import SiteShell from "@/components/layout/SiteShell"

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="dp-container py-16 max-w-3xl">
        <h1 className="font-display text-5xl text-dp-text-primary mb-4">Privacy Policy</h1>
        <p className="text-[13px] text-dp-text-tertiary mb-8">Last updated: June 30, 2026</p>
        <div className="prose prose-sm text-dp-text-secondary space-y-4 text-[14px] leading-relaxed">
          <p>Kolekcia respects your privacy. This policy explains what data we collect, how we use it, and your rights.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Information We Collect</h2>
          <p>We collect account information (name, email), order and shipping details, payment references, and usage data to operate the marketplace.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">How We Use Data</h2>
          <p>We use your data to process orders, provide customer support, improve our services, and send updates you opt into.</p>
          <h2 className="font-display text-2xl text-dp-text-primary mt-8">Your Rights</h2>
          <p>You may request access, correction, or deletion of your personal data by contacting us at support@kolekcia.com.</p>
        </div>
      </div>
    </SiteShell>
  )
}
