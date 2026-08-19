"use client"

import React, { useEffect, useState } from "react"
import { Award, ChevronLeft, ChevronRight, Gift, ImagePlus, Pencil, Plus, ScrollText, ShoppingBag, Star, Trash2, X } from "lucide-react"
import { adminFetch, getAdminToken, getAdminUser, type AdminUser } from "@/lib/admin-auth"
import { parseList, type PaginatedResponse } from "@/lib/api"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"

type PointsMarketItem = {
  id: number
  name: string
  description: string
  vendor: number | null
  vendor_name?: string | null
  vendor_slug?: string | null
  main_image_url: string
  image_urls: string[]
  point_cost: number
  stock_quantity: number
  item_type: "physical" | "digital"
  voucher_discount_type: "percent" | "fixed"
  voucher_discount_value: string
  voucher_min_order_value: string
  is_active: boolean
  is_locked: boolean
  created_at: string
}

type PointTransaction = {
  id: number
  transaction_type: string
  status: string
  points: number
  description: string
  order_number?: string | null
  market_item_name?: string | null
  user_email?: string
  user_name?: string
  created_at: string
}

type PointsMarketRedemption = {
  id: number
  status: "pending" | "approved" | "shipped" | "delivered" | "cancelled"
  user_email?: string
  user_name?: string
  item_name: string
  item_image_url: string
  point_cost: number
  shipping_name: string
  shipping_line1: string
  shipping_line2: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  shipping_country: string
  shipping_email: string
  shipping_phone: string
  shipping_type: string
  shipping_label: string
  shipping_price: string
  shipping_currency: string
  tracking_code: string
  admin_note: string
  created_at: string
}

type LoyaltyTier = {
  tier_key: "genin" | "chunin" | "jonin"
  label: string
  min_lifetime_points: number
  max_lifetime_points: number | null
  discount_percent: string
}

type MarketForm = {
  name: string
  description: string
  vendor: string
  main_image_url: string
  image_urls: string[]
  point_cost: string
  stock_quantity: string
  item_type: "physical" | "digital"
  voucher_discount_type: "percent" | "fixed"
  voucher_discount_value: string
  voucher_min_order_value: string
  is_active: boolean
}

type LoyaltyAdminTab = "overview" | "market" | "redemptions" | "ledger"

type VendorOption = {
  id: number
  name: string
  slug: string
}

const EMPTY_FORM: MarketForm = {
  name: "",
  description: "",
  vendor: "",
  main_image_url: "",
  image_urls: [],
  point_cost: "250",
  stock_quantity: "1",
  item_type: "digital",
  voucher_discount_type: "percent",
  voucher_discount_value: "5",
  voucher_min_order_value: "0",
  is_active: true,
}

const FIXED_TIERS: LoyaltyTier[] = [
  { tier_key: "genin", label: "Genin", min_lifetime_points: 0, max_lifetime_points: 350, discount_percent: "0" },
  { tier_key: "chunin", label: "Chunin", min_lifetime_points: 350, max_lifetime_points: 1000, discount_percent: "5" },
  { tier_key: "jonin", label: "Jonin", min_lifetime_points: 1000, max_lifetime_points: null, discount_percent: "10" },
]

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

export default function AdminGamificationPage(): React.ReactElement {
  const [items, setItems] = useState<PointsMarketItem[]>([])
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [transactions, setTransactions] = useState<PointTransaction[]>([])
  const [redemptions, setRedemptions] = useState<PointsMarketRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PointsMarketItem | null>(null)
  const [form, setForm] = useState<MarketForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [marketSlides, setMarketSlides] = useState<Record<number, number>>({})
  const [activeTab, setActiveTab] = useState<LoyaltyAdminTab>("overview")
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)

  const isVendorAdmin = !!adminUser?.vendor && !adminUser.is_staff
  const vendorId = adminUser?.vendor?.id ? String(adminUser.vendor.id) : ""

  function loadData() {
    setLoading(true)
    setError("")
    Promise.all([
      adminFetch<PointsMarketItem[] | PaginatedResponse<PointsMarketItem>>("/admin/gamification/market/"),
      adminFetch<PointTransaction[] | PaginatedResponse<PointTransaction>>("/admin/gamification/transactions/"),
      adminFetch<PointsMarketRedemption[] | PaginatedResponse<PointsMarketRedemption>>("/admin/gamification/redemptions/"),
      adminFetch<VendorOption[] | PaginatedResponse<VendorOption> | VendorOption>("/vendors/me/"),
    ])
      .then(([marketData, transactionData, redemptionData, vendorData]) => {
        setItems(parseList(marketData))
        setTransactions(parseList(transactionData).slice(0, 12))
        setRedemptions(parseList(redemptionData).slice(0, 20))
        setVendors(normalizeVendors(vendorData))
      })
      .catch((err) => setError(getAdminErrorMessage(err, "Failed to load loyalty data.")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const storedAdmin = getAdminUser()
    setAdminUser(storedAdmin)
    if (storedAdmin?.vendor && !storedAdmin.is_staff) {
      setActiveTab("market")
      setForm((prev) => ({ ...prev, item_type: "physical", vendor: String(storedAdmin.vendor?.id || "") }))
    }
    loadData()
  }, [])

  function normalizeVendors(data: VendorOption[] | PaginatedResponse<VendorOption> | VendorOption): VendorOption[] {
    if (Array.isArray(data) || "results" in data) return parseList(data as VendorOption[] | PaginatedResponse<VendorOption>)
    return data?.id ? [data] : []
  }

  function saleBonusForTier(tier: LoyaltyTier): number {
    if (tier.tier_key === "chunin") return 5
    if (tier.tier_key === "jonin") return 10
    return 0
  }

  function tierRuleText(tier: LoyaltyTier): string {
    const bonus = saleBonusForTier(tier)
    if (bonus <= 0) return "No extra sale bonus. Vouchers can be used on non-sale products."
    return `Automatically adds +${bonus.toFixed(0)}% on sale products only. Vouchers still apply only to non-sale products.`
  }

  function openCreate() {
    setEditingItem(null)
    setForm(isVendorAdmin ? { ...EMPTY_FORM, item_type: "physical", vendor: vendorId } : EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(item: PointsMarketItem) {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description,
      vendor: item.vendor ? String(item.vendor) : "",
      main_image_url: item.main_image_url || "",
      image_urls: item.image_urls || [],
      point_cost: String(item.point_cost),
      stock_quantity: String(item.stock_quantity),
      item_type: item.item_type,
      voucher_discount_type: item.voucher_discount_type || "percent",
      voucher_discount_value: String(item.voucher_discount_value || "5"),
      voucher_min_order_value: String(item.voucher_min_order_value || "0"),
      is_active: item.is_active,
    })
    setShowModal(true)
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      vendor: form.item_type === "physical" && (isVendorAdmin ? vendorId : form.vendor) ? Number(isVendorAdmin ? vendorId : form.vendor) : null,
      main_image_url: form.main_image_url,
      image_urls: form.image_urls,
      point_cost: Number(form.point_cost),
      stock_quantity: Number(form.stock_quantity),
      item_type: form.item_type,
      voucher_discount_type: form.voucher_discount_type,
      voucher_discount_value: Number(form.voucher_discount_value || 0),
      voucher_min_order_value: Number(form.voucher_min_order_value || 0),
      is_active: form.is_active,
    }
    try {
      if (editingItem) {
        const updated = await adminFetch<PointsMarketItem>(`/admin/gamification/market/${editingItem.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } else {
        const created = await adminFetch<PointsMarketItem>("/admin/gamification/market/", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setItems((prev) => [created, ...prev])
      }
      setShowModal(false)
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to save market item."))
    } finally {
      setSaving(false)
    }
  }

  async function uploadMarketImage(file: File) {
    setUploadingImage(true)
    setError("")
    try {
      const token = getAdminToken()
      const data = new FormData()
      data.append("file", file)
      data.append("folder", "points-market")
      const response = await fetch(`${API_BASE}/admin/media/upload/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: data,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw { data: payload }
      const url = String(payload.url || "")
      if (!url) throw new Error("Upload did not return an image URL.")
      setForm((prev) => {
        const nextImages = [...prev.image_urls, url].slice(0, 12)
        return {
          ...prev,
          image_urls: nextImages,
          main_image_url: prev.main_image_url || url,
        }
      })
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to upload market image."))
    } finally {
      setUploadingImage(false)
    }
  }

  function removeMarketImage(url: string) {
    setForm((prev) => {
      const nextImages = prev.image_urls.filter((image) => image !== url)
      return {
        ...prev,
        image_urls: nextImages,
        main_image_url: prev.main_image_url === url ? (nextImages[0] || "") : prev.main_image_url,
      }
    })
  }

  function marketImages(item: PointsMarketItem): string[] {
    const urls = [item.main_image_url, ...(item.image_urls || [])].filter(Boolean)
    return Array.from(new Set(urls))
  }

  function shiftMarketSlide(itemId: number, count: number, direction: -1 | 1) {
    setMarketSlides((prev) => {
      const current = prev[itemId] || 0
      return { ...prev, [itemId]: (current + direction + count) % count }
    })
  }

  async function deleteItem(item: PointsMarketItem) {
    if (!confirm(`Delete points market item "${item.name}"?`)) return
    setError("")
    try {
      await adminFetch(`/admin/gamification/market/${item.id}/`, { method: "DELETE" })
      setItems((prev) => prev.filter((entry) => entry.id !== item.id))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to delete market item."))
    }
  }

  async function updateRedemption(id: number, payload: Partial<Pick<PointsMarketRedemption, "status" | "tracking_code" | "admin_note">>) {
    try {
      const updated = await adminFetch<PointsMarketRedemption>(`/admin/gamification/redemptions/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
      setRedemptions((prev) => prev.map((redemption) => (redemption.id === id ? updated : redemption)))
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to update redemption."))
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Loyalty</h1>
          <p className="text-[13px] text-dp-text-tertiary mt-1">
            {isVendorAdmin ? "Manage your vendor points market products and fulfillment redemptions." : "Manage tier policy, points market items, and the immutable points ledger."}
          </p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-dp-accent-cta text-white text-[11px] font-black uppercase tracking-widest rounded-sm">
          <Plus size={14} /> {isVendorAdmin ? "Add reward product" : "Add product or voucher"}
        </button>
      </div>

      {error && <div className="px-4 py-3 bg-dp-accent-cta/10 border border-dp-accent-cta/30 rounded-sm text-[13px] text-dp-accent-cta">{error}</div>}

      <div className="flex flex-wrap gap-2 rounded-sm border border-dp-border bg-dp-bg-surface p-2">
        {[
          ...(!isVendorAdmin ? [{ id: "overview", label: "Overview", Icon: Award }] : []),
          { id: "market", label: "Points Market", Icon: Gift },
          { id: "redemptions", label: "Points Redemptions", Icon: ShoppingBag },
          { id: "ledger", label: "Points Ledger", Icon: ScrollText },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as LoyaltyAdminTab)}
            className={`inline-flex items-center gap-2 rounded-sm px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${activeTab === id ? "bg-dp-accent-cta text-white" : "text-dp-text-secondary hover:bg-dp-bg-elevated hover:text-dp-text-primary"}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <div className="mb-4">
          <h2 className="font-display text-2xl text-dp-text-primary flex items-center gap-2"><Award size={17} className="text-dp-accent-gold" /> Automatic Sale Bonuses</h2>
          <p className="text-[12px] text-dp-text-tertiary mt-1">Levels are automatic. Tier bonuses apply only to products already marked as sale. Vouchers apply only to non-sale products.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          {FIXED_TIERS.map((tier) => (
            <article key={tier.tier_key} className="bg-dp-bg-elevated border border-dp-border rounded-sm p-4 flex flex-col gap-3">
              <p className="font-display text-2xl text-dp-text-primary">{tier.label}</p>
              <p className="text-[11px] text-dp-text-tertiary">
                {tier.min_lifetime_points.toLocaleString()} - {tier.max_lifetime_points == null ? "infinity" : tier.max_lifetime_points.toLocaleString()} current points
              </p>
              <p className="font-display text-4xl text-dp-accent-gold">+{saleBonusForTier(tier).toFixed(0)}%</p>
              <p className="text-[12px] text-dp-text-secondary leading-relaxed">{tierRuleText(tier)}</p>
            </article>
          ))}
        </div>
      </section>}

      {activeTab === "redemptions" && <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <h2 className="font-display text-2xl text-dp-text-primary flex items-center gap-2 mb-4"><ShoppingBag size={17} className="text-dp-accent-gold" /> Points Redemptions</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead className="text-dp-text-tertiary uppercase tracking-widest">
              <tr className="border-b border-dp-border">
                <th className="py-2 pr-4">Reward</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Fulfillment</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Tracking</th>
                <th className="py-2 pr-4">Admin note</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((redemption) => (
                <tr key={redemption.id} className="border-b border-dp-border/70 align-top last:border-b-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      {redemption.item_image_url && <img src={redemption.item_image_url} alt="" className="h-12 w-12 rounded-sm object-contain border border-dp-border bg-dp-bg-elevated p-1" />}
                      <div>
                        <p className="font-semibold text-dp-text-primary">{redemption.item_name}</p>
                        <p className="text-[11px] text-dp-text-tertiary">{redemption.point_cost.toLocaleString()} pts · {new Date(redemption.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-dp-text-primary">{redemption.user_name || redemption.shipping_name}</p>
                    <p className="text-[11px] text-dp-text-tertiary">{redemption.user_email || redemption.shipping_email}</p>
                    {redemption.shipping_phone && <p className="text-[11px] text-dp-text-tertiary">{redemption.shipping_phone}</p>}
                  </td>
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-dp-text-primary">{redemption.shipping_label}</p>
                    <p className="text-[11px] text-dp-text-tertiary">{Number(redemption.shipping_price) > 0 ? `${redemption.shipping_price} ${redemption.shipping_currency}` : "Free"}</p>
                    <p className="mt-1 max-w-xs text-[11px] text-dp-text-secondary">
                      {redemption.shipping_line1}, {redemption.shipping_city}, {redemption.shipping_state}, {redemption.shipping_zip}, {redemption.shipping_country}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={redemption.status}
                      onChange={(e) => updateRedemption(redemption.id, { status: e.target.value as PointsMarketRedemption["status"] })}
                      className="rounded-sm border border-dp-border bg-dp-bg-elevated px-2 py-1.5 text-[12px] text-dp-text-primary"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      value={redemption.tracking_code || ""}
                      onChange={(e) => setRedemptions((prev) => prev.map((row) => row.id === redemption.id ? { ...row, tracking_code: e.target.value } : row))}
                      onBlur={(e) => updateRedemption(redemption.id, { tracking_code: e.target.value })}
                      placeholder="Tracking code"
                      className="w-36 rounded-sm border border-dp-border bg-dp-bg-elevated px-2 py-1.5 text-[12px] text-dp-text-primary"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <textarea
                      value={redemption.admin_note || ""}
                      onChange={(e) => setRedemptions((prev) => prev.map((row) => row.id === redemption.id ? { ...row, admin_note: e.target.value } : row))}
                      onBlur={(e) => updateRedemption(redemption.id, { admin_note: e.target.value })}
                      placeholder="Internal note"
                      rows={2}
                      className="w-52 resize-none rounded-sm border border-dp-border bg-dp-bg-elevated px-2 py-1.5 text-[12px] text-dp-text-primary"
                    />
                  </td>
                </tr>
              ))}
              {redemptions.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-dp-text-tertiary">No physical points redemptions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>}

      {activeTab === "market" && <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl text-dp-text-primary flex items-center gap-2"><Gift size={17} className="text-dp-accent-cta" /> Points Market</h2>
            <p className="text-[12px] text-dp-text-tertiary mt-1">
              {isVendorAdmin ? "Add physical rewards from your store and manage their stock/photos." : "Add rewards users can buy with spendable points: physical products with stock or digital vouchers."}
            </p>
          </div>
          <button type="button" onClick={openCreate} className="hidden sm:inline-flex items-center justify-center gap-2 px-3 py-2 border border-dp-border text-[11px] font-black uppercase tracking-widest rounded-sm text-dp-text-primary hover:border-dp-border-hover">
            <Plus size={13} /> Add item
          </button>
        </div>
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,260px))] items-start justify-start gap-3 animate-pulse">{[1, 2, 3, 4].map((i) => <div key={i} className="h-36 bg-dp-bg-elevated rounded-sm" />)}</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,260px))] items-start justify-start gap-3">
            {items.map((item) => (
              <article key={item.id} className="self-start w-full p-3.5 bg-dp-bg-elevated border border-dp-border rounded-sm">
                {marketImages(item).length > 0 && (
                  <div className="relative mb-3 h-32 sm:h-36 overflow-hidden rounded-sm border border-dp-border bg-dp-bg-surface">
                    <img
                      src={marketImages(item)[marketSlides[item.id] || 0] || marketImages(item)[0]}
                      alt={item.name}
                      className="h-full w-full object-contain p-1"
                    />
                    {marketImages(item).length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => shiftMarketSlide(item.id, marketImages(item).length, -1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center"
                          aria-label="Previous image"
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftMarketSlide(item.id, marketImages(item).length, 1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center"
                          aria-label="Next image"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </>
                    )}
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-dp-text-tertiary">{item.item_type === "digital" ? "Digital voucher" : "Physical product"}</p>
                    <h3 className="font-display text-lg leading-tight text-dp-text-primary mt-1">{item.name}</h3>
                    {item.item_type === "physical" && item.vendor_name && (
                      <p className="text-[11px] text-dp-accent-gold mt-1">{item.vendor_name}</p>
                    )}
                    {item.item_type === "digital" && (
                      <p className="text-[11px] text-dp-accent-gold mt-1">
                        {item.voucher_discount_type === "percent" ? `${Number(item.voucher_discount_value || 0).toFixed(0)}% checkout voucher` : `$${Number(item.voucher_discount_value || 0).toFixed(2)} checkout voucher`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openEdit(item)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary" aria-label="Edit"><Pencil size={12} /></button>
                    <button type="button" onClick={() => deleteItem(item)} className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta" aria-label="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-dp-text-secondary mt-2 line-clamp-2">{item.description || "No description."}</p>
                <div className="mt-4 flex items-center justify-between text-[12px]">
                  <span className="font-display text-xl text-dp-text-primary">{item.point_cost.toLocaleString()} pts</span>
                  <span className={item.stock_quantity > 0 && item.is_active ? "text-dp-success" : "text-dp-accent-cta"}>
                    {item.stock_quantity > 0 && item.is_active ? `${item.stock_quantity} stock` : "Locked"}
                  </span>
                </div>
              </article>
            ))}
            {items.length === 0 && <p className="col-span-full py-8 text-center text-[13px] text-dp-text-tertiary">No points market items yet.</p>}
          </div>
        )}
      </section>}

      {activeTab === "ledger" && <section className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
        <h2 className="font-display text-2xl text-dp-text-primary flex items-center gap-2 mb-4"><ScrollText size={17} className="text-dp-text-tertiary" /> Points Ledger</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="text-dp-text-tertiary uppercase tracking-widest">
              <tr className="border-b border-dp-border">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Points</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Reference</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((entry) => (
                <tr key={entry.id} className="border-b border-dp-border/70 last:border-b-0">
                  <td className="py-3 pr-4 text-dp-text-secondary">{new Date(entry.created_at).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-dp-text-primary">{entry.transaction_type}</td>
                  <td className="py-3 pr-4 text-dp-text-secondary">{entry.status}</td>
                  <td className={`py-3 pr-4 font-black ${entry.points >= 0 ? "text-dp-success" : "text-dp-accent-cta"}`}>{entry.points}</td>
                  <td className="py-3 pr-4 text-dp-text-secondary">
                    <span className="block text-dp-text-primary">{entry.user_name || "-"}</span>
                    {entry.user_email && <span className="block text-[11px] text-dp-text-tertiary">{entry.user_email}</span>}
                  </td>
                  <td className="py-3 pr-4 text-dp-text-tertiary">{entry.order_number || entry.market_item_name || entry.description || "-"}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-dp-text-tertiary">No ledger entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg bg-dp-bg-surface border border-dp-border rounded-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dp-border">
              <h2 className="font-display text-xl text-dp-text-primary">{editingItem ? "Edit Points Market Item" : "Add Points Market Item"}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-dp-text-tertiary hover:text-dp-text-primary"><X size={18} /></button>
            </div>
            <form onSubmit={saveItem} className="p-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Name</span>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Description</span>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary resize-none" />
              </label>
              {form.item_type === "physical" && (
                <div className="border border-dp-border rounded-sm p-4 bg-dp-bg-elevated">
                  <label className="mb-4 flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Reward vendor</span>
                    <select
                      required
                      value={form.vendor}
                      onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                      disabled={isVendorAdmin}
                      className="px-3 py-2 bg-dp-bg-surface border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                    >
                      <option value="">Choose vendor for shipping</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                    <span className="text-[11px] text-dp-text-tertiary">Physical rewards use this vendor's shipping options in the customer popup.</span>
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Product photos</p>
                      <p className="text-[11px] text-dp-text-tertiary mt-1">Upload photos, choose the main one, and keep up to 12 gallery images.</p>
                    </div>
                    <label className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-dp-text-primary text-white text-[11px] font-black uppercase tracking-widest rounded-sm cursor-pointer">
                      <ImagePlus size={13} />
                      {uploadingImage ? "Uploading..." : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadMarketImage(file)
                          e.currentTarget.value = ""
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {form.image_urls.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {form.image_urls.map((url) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-sm border border-dp-border bg-dp-bg-surface">
                          <img src={url} alt="Points market item" className="h-full w-full object-cover" />
                          <div className="absolute inset-x-2 bottom-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, main_image_url: url }))}
                              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm ${form.main_image_url === url ? "bg-dp-accent-gold text-dp-bg" : "bg-black/65 text-white"}`}
                            >
                              <Star size={10} /> Main
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMarketImage(url)}
                              className="w-7 flex items-center justify-center bg-black/65 text-white rounded-sm"
                              aria-label="Remove image"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-[12px] text-dp-text-tertiary">No photos uploaded yet.</p>
                  )}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Point cost</span>
                  <input required type="number" min="1" value={form.point_cost} onChange={(e) => setForm((f) => ({ ...f, point_cost: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Stock quantity</span>
                  <input required type="number" min="0" value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Item type</span>
                  <select
                    value={form.item_type}
                    onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value as MarketForm["item_type"], vendor: e.target.value === "physical" && isVendorAdmin ? vendorId : f.vendor }))}
                    disabled={isVendorAdmin}
                    className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary"
                  >
                    {!isVendorAdmin && <option value="digital">Digital Voucher</option>}
                    <option value="physical">Physical Product</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-dp-text-secondary pt-5">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                  Active in market
                </label>
              </div>
              {form.item_type === "digital" && (
                <div className="grid sm:grid-cols-3 gap-3 rounded-sm border border-dp-accent-gold/25 bg-dp-accent-gold/5 p-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Voucher type</span>
                    <select value={form.voucher_discount_type ?? "percent"} onChange={(e) => setForm((f) => ({ ...f, voucher_discount_type: e.target.value as MarketForm["voucher_discount_type"] }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary">
                      <option value="percent">Percentage</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">{form.voucher_discount_type === "percent" ? "Discount %" : "Discount amount"}</span>
                    <input required type="number" min="0.01" step="0.01" value={form.voucher_discount_value ?? ""} onChange={(e) => setForm((f) => ({ ...f, voucher_discount_value: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Min order value</span>
                    <input type="number" min="0" step="0.01" value={form.voucher_min_order_value ?? ""} onChange={(e) => setForm((f) => ({ ...f, voucher_min_order_value: e.target.value }))} className="px-3 py-2 bg-dp-bg-elevated border border-dp-border rounded-sm text-[13px] text-dp-text-primary" />
                  </label>
                  <p className="sm:col-span-3 text-[11px] text-dp-text-secondary">
                    After purchase, the customer receives an autogenerated one-use promo code for checkout.
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-dp-border text-[12px] font-bold uppercase tracking-widest rounded-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-dp-accent-cta text-white text-[12px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
