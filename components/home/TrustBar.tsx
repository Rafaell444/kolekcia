"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Clock, Shield, Truck } from "lucide-react"

type TrustLogo = { name: string; bg: string; text: string; label: string }
type TrustItem = { id: number | string; key: string; title: string; description: string; logos: TrustLogo[]; icon: string }

// Info bar: fast delivery, secure payments, 100-day returns
const TRUST_ITEMS: TrustItem[] = [
  {
    id: "delivery",
    key: "delivery",
    title: "Fast delivery",
    description: "At your door in a few days",
    logos: [
      { name: "DHL",   bg: "#FFCC00", text: "#D40511", label: "DHL" },
      { name: "UPS",   bg: "#351C15", text: "#FFB500", label: "UPS" },
      { name: "FedEx", bg: "#4D148C", text: "#FF6600", label: "FedEx" },
    ],
    icon: "truck",
  },
  {
    id: "payments",
    key: "payments",
    title: "Secure payments",
    description: "100% Secure payment with 256-bit SSL Encryption",
    logos: [
      { name: "Visa",       bg: "#1A1F71", text: "#fff",     label: "VISA" },
      { name: "Mastercard", bg: "#EB001B", text: "#fff",     label: "MC" },
      { name: "Apple Pay",  bg: "#000",    text: "#fff",     label: "Pay" },
      { name: "Google Pay", bg: "#fff",    text: "#3c4043",  label: "GPay" },
      { name: "PayPal",     bg: "#003087", text: "#fff",     label: "PP" },
    ],
    icon: "shield",
  },
  {
    id: "returns",
    key: "returns",
    title: "100 days for return",
    description: "Easy return, no questions asked",
    logos: [],
    icon: "clock",
  },
]

function trustIcon(icon: string) {
  const className = "w-8 h-8 text-dp-text-tertiary"
  switch (icon) {
    case "shield": return <Shield className={className} strokeWidth={1.5} aria-hidden />
    case "clock": return <Clock className={className} strokeWidth={1.5} aria-hidden />
    case "truck":
    default: return <Truck className={className} strokeWidth={1.5} aria-hidden />
  }
}

export default function TrustBar() {
  const [items, setItems] = useState(TRUST_ITEMS)
  useEffect(() => {
    apiFetch<TrustItem[]>("/cms/trust-bar/").then((data) => {
      if (Array.isArray(data) && data.length) setItems(data)
    }).catch(() => {})
  }, [])
  return (
    <section className="py-6" aria-label="Trust and payment information">
      <div className="dp-container">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center text-center gap-3 p-6 bg-dp-bg-surface border border-dp-border rounded-xl"
            >
              <div className="mb-1">{trustIcon(item.icon)}</div>
              <div>
                <p className="text-[15px] font-bold text-dp-text-primary mb-0.5">{item.title}</p>
                <p className="text-[12px] text-dp-text-secondary leading-relaxed">{item.description}</p>
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
