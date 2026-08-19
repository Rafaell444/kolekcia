"use client"

import React, { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { Gavel, Plus, Pencil, Trash2, X, Radio, Clock, Trophy } from "lucide-react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"
import AdminMediaUpload from "@/components/admin/AdminMediaUpload"
import AdminFaqsPage from "@/app/admin/faqs/page"
import TranslationFields from "@/components/admin/TranslationFields"

type AuctionBid = {
  id: number
  user_id?: string
  user_name: string
  user_email: string
  amount: string
  placed_at: string
  is_disqualified?: boolean
  disqualification_reason?: string
}

type Auction = {
  id: string
  title: string
  title_ka?: string
  artist_name: string
  image_url: string
  effective_image?: string
  product_id?: number | null
  reserved_size_variant?: number | null
  reserved_variant_label?: string | null
  inventory_reserved?: boolean
  starting_bid: string
  shipping_price_gel: string
  shipping_price_usd: string
  current_bid: string
  starts_at: string
  ends_at: string
  status: string
  is_live: boolean
  is_upcoming?: boolean
  is_biddable?: boolean
  bid_count: number
  winner_name?: string | null
  winning_amount?: string | null
  winner_payment_status?: string
  is_replacement_winner?: boolean
  paid_at?: string | null
  all_bids?: AuctionBid[] | null
  recent_bids?: AuctionBid[]
}

type ProductOption = {
  id: number
  title: string
  title_ka?: string
  artist_name?: string
  image_url?: string
  size_variants?: Array<{
    id: number
    label: string
    stock: number | null
    is_active: boolean
    is_ready_to_ship: boolean
  }>
}

type AuctionForm = {
  product_id: string
  reserved_size_variant_id: string
  title: string
  title_ka: string
  artist_name: string
  image_url: string
  starting_bid: string
  shipping_price_gel: string
  shipping_price_usd: string
  starts_at: string
  ends_at: string
  status: string
}

const EMPTY_FORM: AuctionForm = {
  product_id: "",
  reserved_size_variant_id: "",
  title: "",
  title_ka: "",
  artist_name: "",
  image_url: "",
  starting_bid: "10",
  shipping_price_gel: "0",
  shipping_price_usd: "0",
  starts_at: "",
  ends_at: "",
  status: "active",
}

const ARTIST_OPTIONS = [
  { value: "Sculpi", label: "Sculpi" },
  { value: "MangaMoon", label: "MangaMoon" },
] as const

function vendorArtistName(vendor?: { name?: string; slug?: string } | null): string {
  if (!vendor) return ""
  if (vendor.slug === "sculpi" || vendor.slug === "figure-studio") return "Sculpi"
  if (vendor.slug === "mangamoon") return "MangaMoon"
  return vendor.name ?? ""
}

function toLocalInput(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string {
  if (!value) return new Date().toISOString()
  return new Date(value).toISOString()
}

function getAdminErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback
  const data = (err as { data?: Record<string, unknown> }).data
  if (!data) return fallback
  if (typeof data.detail === "string") return data.detail
  for (const value of Object.values(data)) {
    if (typeof value === "string") return value
    if (Array.isArray(value) && value.length > 0) return String(value[0])
  }
  return fallback
}

function statusBadge(a: Auction) {
  if (a.status === "bought") return { label: "Bought", cls: "text-dp-success bg-dp-success/10 border-dp-success/30" }
  if (a.status === "inactive") return { label: "Not active", cls: "text-dp-text-tertiary bg-dp-bg-elevated border-dp-border" }
  if (a.is_upcoming) return { label: "Scheduled", cls: "text-blue-400 bg-blue-400/10 border-blue-400/30" }
  if (a.is_biddable || a.is_live) return { label: "Active", cls: "text-dp-accent-cta bg-dp-accent-cta/10 border-dp-accent-cta/30" }
  if (a.status === "active") return { label: "Ended", cls: "text-dp-accent-gold bg-dp-accent-gold/10 border-dp-accent-gold/30" }
  return { label: a.status, cls: "text-dp-text-tertiary bg-dp-bg-elevated border-dp-border" }
}

export default function AuctionManager(): React.ReactElement {
  const adminUser = getAdminUser()
  const isVendorOnly = Boolean(adminUser?.vendor) && !adminUser?.is_staff
  const defaultArtistName = isVendorOnly ? vendorArtistName(adminUser?.vendor) : ARTIST_OPTIONS[0].value
  const auctionBase = isVendorOnly ? "/auctions/vendor" : "/admin/auctions"
  const productsUrl = isVendorOnly ? "/vendors/me/products/" : "/admin/products/"

  const [auctions, setAuctions] = useState<Auction[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [detailAuction, setDetailAuction] = useState<Auction | null>(null)
  const [editing, setEditing] = useState<Auction | null>(null)
  const [form, setForm] = useState<AuctionForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadAuctions = useCallback(() => {
    setLoading(true)
    adminFetch<Auction[] | PaginatedResponse<Auction>>(`${auctionBase}/`)
      .then((data) => setAuctions(parseList(data)))
      .catch((err) => setError(getAdminErrorMessage(err, "Failed to load auctions.")))
      .finally(() => setLoading(false))
  }, [auctionBase])

  useEffect(() => {
    loadAuctions()
    adminFetch<ProductOption[] | PaginatedResponse<ProductOption>>(productsUrl)
      .then((data) => {
        const list = parseList(data) as Array<{ id: number; title?: string; title_ka?: string; artist_name?: string; image_url?: string; images?: Array<{ url?: string; src?: string }>; size_variants?: ProductOption["size_variants"] }>
        setProducts(list.map((p) => ({
          id: p.id,
          title: p.title ?? `Product #${p.id}`,
          title_ka: p.title_ka ?? "",
          artist_name: p.artist_name ?? "",
          image_url: p.image_url || p.images?.[0]?.url || p.images?.[0]?.src || "",
          size_variants: p.size_variants ?? [],
        })))
      })
      .catch(() => {})
  }, [loadAuctions, productsUrl])

  function openCreate() {
    const now = new Date()
    const ends = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    setEditing(null)
    setForm({
      ...EMPTY_FORM,
      artist_name: defaultArtistName,
      starts_at: toLocalInput(now.toISOString()),
      ends_at: toLocalInput(ends.toISOString()),
    })
    setShowModal(true)
    setError("")
  }

  function openEdit(a: Auction) {
    const linked = a.product_id ? products.find((p) => p.id === a.product_id) : null
    setEditing(a)
    setForm({
      product_id: a.product_id ? String(a.product_id) : "",
      reserved_size_variant_id: a.reserved_size_variant ? String(a.reserved_size_variant) : "",
      title: linked?.title ?? a.title,
      title_ka: linked?.title_ka ?? a.title_ka ?? "",
      artist_name: a.artist_name ?? "",
      image_url: a.image_url ?? "",
      starting_bid: a.starting_bid,
      shipping_price_gel: a.shipping_price_gel ?? "0",
      shipping_price_usd: a.shipping_price_usd ?? "0",
      starts_at: toLocalInput(a.starts_at),
      ends_at: toLocalInput(a.ends_at),
      status: a.status,
    })
    setShowModal(true)
    setError("")
  }

  function handleProductSelect(productId: string) {
    const product = products.find((p) => String(p.id) === productId)
    setForm((f) => ({
      ...f,
      product_id: productId,
      reserved_size_variant_id: "",
      title: product?.title ?? (productId ? f.title : ""),
      title_ka: product?.title_ka ?? (productId ? f.title_ka : ""),
      artist_name: isVendorOnly ? defaultArtistName : f.artist_name,
      image_url: product?.image_url ?? f.image_url,
    }))
  }

  async function saveAuction(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const selectedProduct = form.product_id
      ? products.find((p) => String(p.id) === form.product_id)
      : null
    const payload = {
      product_id: form.product_id ? parseInt(form.product_id, 10) : null,
      reserved_size_variant_id: form.reserved_size_variant_id ? parseInt(form.reserved_size_variant_id, 10) : null,
      title: selectedProduct?.title ?? form.title,
      title_ka: selectedProduct?.title_ka ?? form.title_ka,
      artist_name: isVendorOnly ? defaultArtistName : form.artist_name,
      image_url: form.image_url,
      starting_bid: form.starting_bid,
      shipping_price_gel: form.shipping_price_gel,
      shipping_price_usd: form.shipping_price_usd,
      starts_at: fromLocalInput(form.starts_at),
      ends_at: fromLocalInput(form.ends_at),
      status: form.status,
    }
    try {
      if (editing) {
        const updated = await adminFetch<Auction>(`${auctionBase}/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        setAuctions((prev) => prev.map((a) => (a.id === editing.id ? updated : a)))
      } else {
        const created = await adminFetch<Auction>(`${auctionBase}/`, {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setAuctions((prev) => [created, ...prev])
      }
      setShowModal(false)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to save auction."))
    } finally {
      setSaving(false)
    }
  }

  async function deleteAuction(id: string) {
    if (!confirm("Delete this auction?")) return
    setError("")
    try {
      await adminFetch(`${auctionBase}/${id}/`, { method: "DELETE" })
      setAuctions((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to delete auction."))
    }
  }

  async function markPaid(id: string) {
    setError("")
    try {
      const updated = isVendorOnly
        ? await adminFetch<Auction>(`/auctions/vendor/${id}/mark-paid/`, { method: "POST" })
        : await adminFetch<Auction>(`/admin/auctions/${id}/`, {
            method: "PATCH",
            body: JSON.stringify({ winner_payment_status: "paid", status: "bought" }),
          })
      setAuctions((prev) => prev.map((a) => (a.id === id ? updated : a)))
      if (detailAuction?.id === id) setDetailAuction(updated)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to mark as paid."))
    }
  }

  async function openDetail(a: Auction) {
    try {
      const full = await adminFetch<Auction>(`${auctionBase}/${a.id}/`)
      setDetailAuction(full)
    } catch {
      setDetailAuction(a)
    }
  }

  function applyManagedAuction(updated: Auction) {
    setAuctions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setDetailAuction(updated)
  }

  async function disqualifyBidder(auctionId: string, bid: AuctionBid) {
    const reason = prompt(
      `Reason for disqualifying ${bid.user_name} and blocking this account from this seller's auctions:`,
      "Winner did not complete payment.",
    )
    if (reason === null) return
    try {
      const updated = await adminFetch<Auction>(`/auctions/vendor/${auctionId}/bids/${bid.id}/disqualify/`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      applyManagedAuction(updated)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to disqualify bidder."))
    }
  }

  async function promoteBid(auctionId: string, bid: AuctionBid) {
    if (!confirm(`Select ${bid.user_name} as the replacement winner at $${parseFloat(bid.amount).toFixed(2)}?`)) return
    try {
      const updated = await adminFetch<Auction>(`/auctions/vendor/${auctionId}/bids/${bid.id}/promote/`, {
        method: "POST",
      })
      applyManagedAuction(updated)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to select replacement winner."))
    }
  }

  async function sendReplacementEmail(auctionId: string) {
    const adminNote = prompt("Optional note to include in the replacement-winner email:", "")
    if (adminNote === null) return
    try {
      const response = await adminFetch<{ detail: string }>(`/auctions/vendor/${auctionId}/send-second-chance/`, {
        method: "POST",
        body: JSON.stringify({ admin_note: adminNote }),
      })
      alert(response.detail)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to send replacement-winner email."))
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Auctions</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">
            {isVendorOnly ? "Manage your auction listings, bids, and payments." : "Create and manage live auction listings."}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-dp-accent-cta hover:bg-dp-accent-cta-hover text-white text-[12px] font-bold uppercase tracking-widest rounded-sm shrink-0"
        >
          <Plus size={14} /> Create Auction
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[13px] text-dp-accent-cta">{error}</div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-dp-bg-elevated rounded-sm" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((a) => {
            const badge = statusBadge(a)
            const img = a.effective_image || a.image_url
            return (
              <div key={a.id} className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-hidden">
                <div className="aspect-video relative bg-dp-bg-elevated">
                  {img && <Image src={img} alt={a.title} fill className="object-cover opacity-80" sizes="(max-width: 640px) 100vw, 33vw" />}
                  <span className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest border ${badge.cls}`}>
                    {a.is_biddable ? <Radio size={9} /> : <Clock size={9} />} {badge.label}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">{a.artist_name}</p>
                  <p className="font-display text-lg text-dp-text-primary leading-tight">{a.title}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Current Bid</p>
                      <p className="font-bold text-dp-text-primary">${parseFloat(a.current_bid || a.starting_bid).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-dp-text-tertiary uppercase tracking-widest">Bids</p>
                      <p className="font-bold text-dp-text-primary flex items-center gap-1 justify-end"><Gavel size={11} /> {a.bid_count}</p>
                    </div>
                  </div>
                  {a.winner_name && (
                    <p className="text-[11px] text-dp-text-secondary mt-2 flex items-center gap-1">
                      <Trophy size={11} className="text-dp-accent-gold" />
                      Winner: {a.winner_name}
                      {a.winning_amount && ` — $${parseFloat(a.winning_amount).toFixed(2)}`}
                      {a.winner_payment_status && ` (${a.winner_payment_status})`}
                    </p>
                  )}
                  <div className="flex gap-1 mt-3">
                    <button type="button" onClick={() => openDetail(a)} className="flex-1 py-1.5 border border-dp-border text-[11px] rounded-sm hover:text-dp-text-primary text-dp-text-tertiary">
                      Bids
                    </button>
                    <button type="button" onClick={() => openEdit(a)} className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-dp-border text-[11px] rounded-sm text-dp-text-tertiary hover:text-dp-text-primary">
                      <Pencil size={11} /> Edit
                    </button>
                    <button type="button" onClick={() => deleteAuction(a.id)} className="w-8 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {auctions.length === 0 && <p className="col-span-3 text-center py-12 text-dp-text-tertiary">No auctions yet.</p>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-8 sm:py-12 bg-black/60 overflow-y-auto">
          <div className="w-full max-w-lg bg-dp-bg-surface border border-dp-border rounded-sm my-auto max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-6rem)] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">{editing ? "Edit Auction" : "Create Auction"}</h2>
              <button type="button" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={saveAuction} className="p-5 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Shop product</span>
                <select
                  value={form.product_id}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]"
                >
                  <option value="">Create auction without a shop product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <span className="text-[10px] text-dp-text-tertiary">
                  Choose an existing product from your shop to copy its title, image, and ready-to-ship units.
                </span>
              </label>
              {!isVendorOnly && (
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Artist Name</span>
                  <select
                    required
                    value={form.artist_name}
                    onChange={(e) => setForm((f) => ({ ...f, artist_name: e.target.value }))}
                    className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]"
                  >
                    {ARTIST_OPTIONS.map((artist) => (
                      <option key={artist.value} value={artist.value}>{artist.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {form.product_id && (() => {
                const readyVariants = products
                  .find((p) => String(p.id) === form.product_id)
                  ?.size_variants?.filter((v) => v.is_active && v.is_ready_to_ship && (v.stock ?? 0) > 0) ?? []
                return (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Ready-to-ship unit</span>
                    <select
                      required
                      value={form.reserved_size_variant_id}
                      disabled={Boolean(editing?.inventory_reserved)}
                      onChange={(e) => setForm((f) => ({ ...f, reserved_size_variant_id: e.target.value }))}
                      className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] disabled:opacity-70"
                    >
                      <option value="">Select variant</option>
                      {readyVariants.map((v) => (
                        <option key={v.id} value={v.id}>{v.label} - stock: {v.stock ?? 0}</option>
                      ))}
                      {editing?.inventory_reserved && editing.reserved_size_variant && (
                        <option value={editing.reserved_size_variant}>{editing.reserved_variant_label || "Reserved unit"}</option>
                      )}
                    </select>
                    <span className="text-[10px] text-dp-text-tertiary">
                      One unit is reserved when the auction becomes active. The last ready unit switches the catalog product to made-to-order.
                    </span>
                  </label>
                )
              })()}
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Title</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  readOnly={Boolean(form.product_id)}
                  className={`px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] ${form.product_id ? "opacity-80 cursor-not-allowed" : ""}`}
                />
                {form.product_id && (
                  <span className="text-[10px] text-dp-text-tertiary">Title and translations match the selected shop product.</span>
                )}
              </label>
              {!form.product_id && (
                <TranslationFields
                  value={form}
                  onChange={setForm}
                  inputClassName="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]"
                  fields={[
                    { key: "title_ka", label: "Title · Georgian" },
                  ]}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Starts</span>
                  <input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Ends</span>
                  <input required type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Minimum starting bid (USD $)</span>
                  <input required type="number" min="0.01" step="0.01" value={form.starting_bid} onChange={(e) => setForm((f) => ({ ...f, starting_bid: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Status</span>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]">
                    <option value="active">Active</option>
                    <option value="inactive">Not active</option>
                    <option value="bought">Bought</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Georgia shipping (GEL)</span>
                  <input required type="number" min="0" step="0.01" value={form.shipping_price_gel} onChange={(e) => setForm((f) => ({ ...f, shipping_price_gel: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Other market shipping (USD)</span>
                  <input required type="number" min="0" step="0.01" value={form.shipping_price_usd} onChange={(e) => setForm((f) => ({ ...f, shipping_price_usd: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px]" />
                </label>
              </div>
              <p className="text-[10px] text-dp-text-tertiary">
                Shipping is charged only after the auction is won. Self-pickup is offered on non-Sculpi auctions.
              </p>
              {!form.product_id && (
                <AdminMediaUpload
                  label="Auction image"
                  previewUrl={form.image_url}
                  folder="auctions"
                  onUploaded={(url) => setForm((f) => ({ ...f, image_url: url }))}
                  previewClassName="w-full h-28"
                />
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="w-full max-w-2xl bg-dp-bg-surface border border-dp-border rounded-sm my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <div>
                <h2 className="font-display text-xl text-dp-text-primary">{detailAuction.title}</h2>
                <p className="text-[12px] text-dp-text-tertiary">{detailAuction.bid_count} bids</p>
              </div>
              <button type="button" onClick={() => setDetailAuction(null)}><X size={18} /></button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {detailAuction.winner_name && (
                <div className="mb-4 p-3 bg-dp-bg-elevated border border-dp-border rounded-sm flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-dp-text-tertiary">Winner</p>
                    <p className="font-semibold text-dp-text-primary">{detailAuction.winner_name}</p>
                    <p className="text-[12px] text-dp-text-secondary">
                      ${parseFloat(detailAuction.winning_amount || detailAuction.current_bid).toFixed(2)}
                      {detailAuction.winner_payment_status && ` — ${detailAuction.winner_payment_status}`}
                    </p>
                  </div>
                  {detailAuction.winner_payment_status !== "paid" && detailAuction.status !== "bought" && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {detailAuction.is_replacement_winner && (
                        <button type="button" onClick={() => sendReplacementEmail(detailAuction.id)} className="px-3 py-1.5 border border-dp-accent-gold text-dp-accent-gold text-[11px] font-bold uppercase tracking-widest rounded-sm">
                          Send Replacement Email
                        </button>
                      )}
                      <button type="button" onClick={() => markPaid(detailAuction.id)} className="px-3 py-1.5 bg-dp-success text-white text-[11px] font-bold uppercase tracking-widest rounded-sm">
                        Mark Paid
                      </button>
                    </div>
                  )}
                </div>
              )}
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-dp-text-tertiary border-b border-dp-border">
                    <th className="text-left py-2">Bidder</th>
                    <th className="text-left py-2">Amount</th>
                    <th className="text-left py-2">Time</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dp-border">
                  {(detailAuction.all_bids ?? detailAuction.recent_bids ?? []).map((b) => (
                    <tr key={b.id} className={b.is_disqualified ? "opacity-50" : ""}>
                      <td className="py-2 text-dp-text-primary">{b.user_name}<br /><span className="text-dp-text-tertiary">{b.user_email}</span></td>
                      <td className="py-2 font-bold">${parseFloat(b.amount).toFixed(2)}</td>
                      <td className="py-2 text-dp-text-tertiary">{new Date(b.placed_at).toLocaleString()}</td>
                      <td className="py-2 text-right">
                        {b.is_disqualified ? (
                          <span className="text-[10px] uppercase tracking-widest text-dp-accent-cta" title={b.disqualification_reason}>Disqualified</span>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-1">
                            {!detailAuction.winner_name && parseFloat(b.amount) === parseFloat(detailAuction.current_bid) && (
                              <button type="button" onClick={() => promoteBid(detailAuction.id, b)} className="px-2 py-1 border border-dp-accent-gold/50 text-dp-accent-gold rounded-sm text-[10px]">Make winner</button>
                            )}
                            {detailAuction.winner_name === b.user_name && (
                              <button type="button" onClick={() => disqualifyBidder(detailAuction.id, b)} className="px-2 py-1 border border-dp-accent-cta/50 text-dp-accent-cta rounded-sm text-[10px]">Ban no-show</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(detailAuction.all_bids ?? detailAuction.recent_bids ?? []).length === 0 && (
                <p className="text-center py-8 text-dp-text-tertiary">No bids yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!isVendorOnly && (
        <div className="mt-12 pt-8 border-t border-dp-border">
          <AdminFaqsPage defaultCategory="auction" />
        </div>
      )}
    </div>
  )
}
