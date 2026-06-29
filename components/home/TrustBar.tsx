// Info bar: fast delivery, secure payments, 100-day returns
const TRUST_ITEMS = [
  {
    id: "delivery",
    title: "Fast delivery",
    desc: "At your door in a few days",
    logos: [
      { name: "DHL",   bg: "#FFCC00", text: "#D40511", label: "DHL" },
      { name: "UPS",   bg: "#351C15", text: "#FFB500", label: "UPS" },
      { name: "FedEx", bg: "#4D148C", text: "#FF6600", label: "FedEx" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8 text-dp-text-tertiary" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    id: "payments",
    title: "Secure payments",
    desc: "100% Secure payment with 256-bit SSL Encryption",
    logos: [
      { name: "Visa",       bg: "#1A1F71", text: "#fff",     label: "VISA" },
      { name: "Mastercard", bg: "#EB001B", text: "#fff",     label: "MC" },
      { name: "Apple Pay",  bg: "#000",    text: "#fff",     label: "Pay" },
      { name: "Google Pay", bg: "#fff",    text: "#3c4043",  label: "GPay" },
      { name: "PayPal",     bg: "#003087", text: "#fff",     label: "PP" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8 text-dp-text-tertiary" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    id: "returns",
    title: "100 days for return",
    desc: "Easy return, no questions asked",
    logos: [],
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10 text-dp-text-tertiary" fill="none" stroke="currentColor" strokeWidth={1.2} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 7v5l3 3" />
        <path strokeLinecap="round" d="M8 4.5A9 9 0 014.5 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3l2.5 1.5L7 7" />
      </svg>
    ),
  },
]

export default function TrustBar() {
  return (
    <section className="py-6" aria-label="Trust and payment information">
      <div className="dp-container">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center text-center gap-3 p-6 bg-dp-bg-surface border border-dp-border rounded-xl"
            >
              <div className="mb-1">{item.icon}</div>
              <div>
                <p className="text-[15px] font-bold text-dp-text-primary mb-0.5">{item.title}</p>
                <p className="text-[12px] text-dp-text-secondary leading-relaxed">{item.desc}</p>
              </div>
              {item.logos.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {item.logos.map((logo) => (
                    <span
                      key={logo.name}
                      className="inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-black"
                      style={{ background: logo.bg, color: logo.text }}
                      title={logo.name}
                    >
                      {logo.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
