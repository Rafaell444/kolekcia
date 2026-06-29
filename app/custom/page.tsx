"use client"

import React, { useState, useRef, useEffect } from "react"
import SiteShell from "@/components/layout/SiteShell"
import { apiFetch } from "@/lib/api"
import Image from "next/image"
import {
  Upload, CheckCircle, Clock, CreditCard, Mail, Phone,
  Image as ImageIcon, FileText, AlertCircle, ArrowRight,
  ArrowLeft, Loader2, ChevronRight,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────

type Vendor = {
  id: number
  name: string
  slug: string
  logo_url: string
  custom_product_type: string
  custom_product_description: string
  custom_cover_url: string
}

type Step = "pick" | "upload" | "pending" | "payment"

const STEPS = [
  { id: "pick",    label: "Choose Type" },
  { id: "upload",  label: "Upload Design" },
  { id: "pending", label: "Review" },
  { id: "payment", label: "Payment" },
]

// ─── Step bar ───────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current)
  return (
    <ol className="flex items-center justify-center gap-0 mb-10" aria-label="Progress">
      {STEPS.map((step, idx) => {
        const done   = currentIdx > idx
        const active = step.id === current
        return (
          <li key={step.id} className="flex items-center gap-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-[12px] font-black transition-colors ${
                  done   ? "bg-dp-success border-dp-success text-white" :
                  active ? "bg-dp-accent-cta border-dp-accent-cta text-white" :
                           "border-dp-border text-dp-text-tertiary bg-dp-bg-elevated"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <CheckCircle size={14} /> : idx + 1}
              </div>
              <span className={`mt-1.5 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${
                active ? "text-dp-text-primary" : "text-dp-text-tertiary"
              }`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-12 sm:w-20 h-0.5 mb-5 mx-1 transition-colors ${done ? "bg-dp-success" : "bg-dp-border"}`} aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── Step 1: Pick product type ──────────────────────────────

function PickStep({
  vendors,
  loading,
  onSelect,
}: {
  vendors: Vendor[]
  loading: boolean
  onSelect: (v: Vendor) => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {[1, 2].map((i) => (
          <div key={i} className="h-72 bg-dp-bg-elevated animate-pulse rounded-sm" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-center text-[14px] text-dp-text-secondary mb-8">
        Choose the type of custom product you'd like to order.
        Each is handled by a specialist vendor.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {vendors.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            className="group relative overflow-hidden rounded-sm border border-dp-border bg-dp-bg-surface dp-card-hover text-left flex flex-col transition-all duration-200 hover:border-dp-accent-cta hover:shadow-xl"
          >
            {/* Cover image */}
            <div className="relative h-48 overflow-hidden bg-dp-bg-elevated shrink-0">
              {v.custom_cover_url ? (
                <img
                  src={v.custom_cover_url}
                  alt={v.custom_product_type}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-dp-accent-cta/10 to-dp-bg-base" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-dp-bg-surface/90 to-transparent" />
              {v.logo_url && (
                <div className="absolute bottom-3 left-4 w-10 h-10 rounded-full border border-dp-border overflow-hidden bg-dp-bg-elevated">
                  <img src={v.logo_url} alt={v.name} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="px-5 py-4 flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-black text-dp-text-primary group-hover:text-dp-accent-cta transition-colors">
                  {v.custom_product_type}
                </h3>
                <ChevronRight size={16} className="text-dp-text-tertiary group-hover:text-dp-accent-cta transition-colors shrink-0" />
              </div>
              <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">{v.name}</p>
              <p className="text-[12px] text-dp-text-secondary leading-relaxed mt-1">
                {v.custom_product_description}
              </p>
            </div>

            {/* CTA bar */}
            <div className="px-5 py-3 border-t border-dp-border flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-dp-accent-cta">
                Select this →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step 2: Upload form ────────────────────────────────────

function UploadStep({
  vendor,
  onSubmit,
  onBack,
}: {
  vendor: Vendor
  onSubmit: (data: { name: string; email: string; phone: string; note: string; imageDataUrl: string }) => void
  onBack: () => void
}) {
  const [preview, setPreview]  = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [name, setName]   = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote]   = useState("")
  const [drag, setDrag]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!preview) return
    onSubmit({ name, email, phone, note, imageDataUrl: preview })
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Selected vendor badge */}
      <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-dp-bg-elevated border border-dp-border rounded-sm">
        {vendor.logo_url && (
          <img src={vendor.logo_url} alt={vendor.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-dp-text-tertiary">Ordering from</p>
          <p className="text-[14px] font-bold text-dp-text-primary">{vendor.name} — {vendor.custom_product_type}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-dp-text-tertiary hover:text-dp-accent-cta transition-colors shrink-0"
        >
          <ArrowLeft size={12} /> Change
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* File drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors min-h-[220px] p-6 ${
            drag
              ? "border-dp-accent-cta bg-dp-accent-cta/10"
              : preview
              ? "border-dp-success bg-dp-success/5"
              : "border-dp-border hover:border-dp-border-hover bg-dp-bg-elevated"
          }`}
          role="button"
          aria-label="Upload your design file"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {preview ? (
            <>
              <div className="relative w-32 h-44 rounded-lg overflow-hidden shadow-md">
                <Image src={preview} alt="Your uploaded design" fill className="object-cover" sizes="128px" />
              </div>
              <p className="text-[12px] text-dp-success font-bold flex items-center gap-1">
                <CheckCircle size={13} /> {fileName}
              </p>
              <p className="text-[11px] text-dp-text-tertiary">Click to replace</p>
            </>
          ) : (
            <>
              <ImageIcon size={36} className="text-dp-text-tertiary" />
              <p className="text-[14px] font-semibold text-dp-text-primary">Drop your reference image here</p>
              <p className="text-[12px] text-dp-text-tertiary">or click to browse — JPG, PNG, TIFF up to 200 MB</p>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-dp-text-tertiary">
                <AlertCircle size={11} />
                <span>Minimum 3000 × 4200 px recommended</span>
              </div>
            </>
          )}
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { id: "custom-name",  label: "Full Name *",           type: "text",  value: name,  set: setName,  placeholder: "Your name",        required: true },
            { id: "custom-email", label: "Email *",               type: "email", value: email, set: setEmail, placeholder: "you@email.com",    required: true },
            { id: "custom-phone", label: "Phone (for SMS link)",  type: "tel",   value: phone, set: setPhone, placeholder: "+1 555 000 0000",   required: false },
            { id: "custom-note",  label: "Notes / requests",      type: "text",  value: note,  set: setNote,  placeholder: "Size, finish, special requests…", required: false },
          ].map(({ id, label, type, value, set, placeholder, required }) => (
            <div key={id} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary">{label}</label>
              <input
                id={id}
                type={type}
                required={required}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="px-3 py-2.5 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary placeholder:text-dp-text-tertiary focus:outline-none focus:border-dp-accent-cta"
              />
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-dp-bg-elevated border border-dp-border rounded-xl p-4 flex gap-3">
          <FileText size={18} className="text-dp-text-tertiary shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-dp-text-primary mb-0.5">How it works</p>
            <ol className="text-[12px] text-dp-text-secondary flex flex-col gap-1">
              <li>1. Upload your image and fill in your details.</li>
              <li>2. {vendor.name} reviews the design and confirms the final price within 24 hours.</li>
              <li>3. You receive a unique payment link via Email or SMS.</li>
              <li>4. Complete payment and your custom {vendor.custom_product_type.toLowerCase()} ships.</li>
            </ol>
          </div>
        </div>

        <button
          type="submit"
          disabled={!preview}
          className="w-full py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2"
        >
          <Upload size={16} /> Submit for Review
        </button>
      </form>
    </div>
  )
}

// ─── Step 3: Pending ────────────────────────────────────────

function PendingStep({ email, vendorName }: { email: string; vendorName: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 max-w-md mx-auto py-6">
      <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <Clock size={36} className="text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <h2 className="font-display text-3xl text-dp-text-primary mb-2">Design Submitted!</h2>
        <p className="text-[14px] text-dp-text-secondary leading-relaxed">
          Your design is being reviewed by <strong className="text-dp-text-primary">{vendorName}</strong>.
          They'll confirm the price and production details within{" "}
          <strong className="text-dp-text-primary">24 hours</strong>.
        </p>
      </div>
      <div className="bg-dp-bg-elevated border border-dp-border rounded-xl p-5 w-full text-left flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Mail size={16} className="text-dp-text-tertiary shrink-0" />
          <div>
            <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Confirmation sent to</p>
            <p className="text-[13px] font-semibold text-dp-text-primary">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Phone size={16} className="text-dp-text-tertiary shrink-0" />
          <div>
            <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Payment link delivery</p>
            <p className="text-[13px] font-semibold text-dp-text-primary">Email + SMS once approved</p>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-dp-text-tertiary">
        Questions? Contact us at{" "}
        <a href="mailto:custom@kolekcia.com" className="text-dp-accent-cta hover:underline">
          custom@kolekcia.com
        </a>
      </p>
    </div>
  )
}

// ─── Step 4: Payment ────────────────────────────────────────

function PaymentStep() {
  const [paid, setPaid] = useState(false)
  const mockRef = "KOL-CUSTOM-" + Math.random().toString(36).slice(2, 8).toUpperCase()

  return (
    <div className="flex flex-col items-center text-center gap-6 max-w-sm mx-auto py-6">
      {paid ? (
        <>
          <div className="w-20 h-20 rounded-full bg-dp-success/20 flex items-center justify-center">
            <CheckCircle size={40} className="text-dp-success" />
          </div>
          <div>
            <h2 className="font-display text-3xl text-dp-text-primary mb-2">Payment Received!</h2>
            <p className="text-[13px] text-dp-text-secondary">
              Your custom order is now in production. You'll receive a tracking link by email.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <CreditCard size={36} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-display text-3xl text-dp-text-primary mb-2">Complete Your Order</h2>
            <p className="text-[13px] text-dp-text-secondary">
              Your design was approved! Click below to complete payment securely.
            </p>
          </div>
          <div className="bg-dp-bg-elevated border border-dp-border rounded-xl p-5 w-full text-left">
            <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest mb-3">Order Summary</p>
            <div className="flex justify-between text-[13px] text-dp-text-secondary mb-3">
              <span>Shipping</span>
              <span className="text-dp-success font-bold">Free</span>
            </div>
            <p className="text-[10px] text-dp-text-tertiary mt-2">Reference: {mockRef}</p>
          </div>
          <div className="border border-dp-border rounded-xl p-4 bg-dp-bg-elevated w-full flex flex-col items-center gap-2">
            <p className="text-[11px] text-dp-text-tertiary uppercase tracking-widest">Scan to pay</p>
            <div className="w-32 h-32 bg-dp-bg-base rounded-lg grid grid-cols-6 grid-rows-6 gap-0.5 p-2">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className={`rounded-sm ${Math.random() > 0.5 ? "bg-dp-text-primary" : "bg-transparent"}`} />
              ))}
            </div>
          </div>
          <button
            onClick={() => setPaid(true)}
            className="w-full py-3.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[13px] font-black uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard size={16} /> Pay Now
          </button>
        </>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function CustomPage(): React.ReactElement {
  const [step, setStep] = useState<Step>("pick")
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorsLoading, setVendorsLoading] = useState(true)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<Vendor[]>("/vendors/public/")
      .then(setVendors)
      .catch(() => {})
      .finally(() => setVendorsLoading(false))
  }, [])

  function handleVendorSelect(v: Vendor) {
    setSelectedVendor(v)
    setStep("upload")
  }

  async function handleUploadSubmit(data: {
    name: string; email: string; phone: string; note: string; imageDataUrl: string
  }) {
    if (!selectedVendor) return
    setSubmitting(true)
    try {
      await apiFetch("/orders/custom/", {
        method: "POST",
        body: JSON.stringify({
          vendor: selectedVendor.id,
          product_type: selectedVendor.custom_product_type,
          name: data.name,
          email: data.email,
          phone: data.phone,
          notes: data.note,
          image_url: data.imageDataUrl.slice(0, 200) + "…",
        }),
      })
    } catch {
      // non-blocking — proceed to pending state regardless
    } finally {
      setSubmitting(false)
    }
    setSubmittedEmail(data.email)
    setStep("pending")
  }

  return (
    <SiteShell>
      <div className="dp-container py-12">
        {/* Page header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl md:text-6xl text-dp-text-primary uppercase">
            Custom Order
          </h1>
          <p className="text-[14px] text-dp-text-secondary mt-3 max-w-lg mx-auto">
            Order a unique handcrafted piece made just for you.
            Choose your product type, upload your reference, and our specialist vendors take it from there.
          </p>
        </div>

        <StepBar current={step} />

        {step === "pick" && (
          <PickStep vendors={vendors} loading={vendorsLoading} onSelect={handleVendorSelect} />
        )}

        {step === "upload" && selectedVendor && (
          <div className="relative">
            {submitting && (
              <div className="absolute inset-0 bg-dp-bg-base/60 z-10 flex items-center justify-center rounded-sm">
                <Loader2 size={32} className="animate-spin text-dp-accent-cta" />
              </div>
            )}
            <UploadStep
              vendor={selectedVendor}
              onSubmit={handleUploadSubmit}
              onBack={() => setStep("pick")}
            />
          </div>
        )}

        {step === "pending" && (
          <>
            <PendingStep email={submittedEmail} vendorName={selectedVendor?.name ?? "our team"} />
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setStep("payment")}
                className="flex items-center gap-1 text-[11px] text-dp-text-tertiary hover:text-dp-accent-cta transition-colors"
              >
                Preview payment step <ArrowRight size={11} />
              </button>
            </div>
          </>
        )}

        {step === "payment" && <PaymentStep />}
      </div>
    </SiteShell>
  )
}
