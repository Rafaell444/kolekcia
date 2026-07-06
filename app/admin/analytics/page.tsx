"use client"

import React, { useEffect, useState } from "react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { TrendingUp, Users, Gavel, Package, Activity } from "lucide-react"

type MonthData = { month: string; revenue: string; orders: number }
type DailyPoint = {
  day: string
  orders: number
  revenue: number
  bids: number
  max_bid: number
}
type BidEntry = {
  bid_id: number
  bidder_name: string
  bidder_email: string
  amount: number
  placed_at: string
}
type AuctionBreakdown = {
  auction_id: number
  title: string
  product_id: number | null
  product_title: string
  ends_at: string
  current_bid: number
  total_bids: number
  unique_bidders: number
  bidders: BidEntry[]
}
type SuperAnalytics = {
  totals: {
    revenue: number
    orders: number
    users: number
    bids: number
    auctions: number
    active_auctions: number
  }
  today: { date: string; revenue: number; orders: number; bids: number }
  rates: {
    revenue_change_pct_vs_yesterday: number
    orders_change_pct_vs_yesterday: number
    bids_change_pct_vs_yesterday: number
  }
  by_day: DailyPoint[]
  auction_bidder_breakdown: AuctionBreakdown[]
}

function DeltaPill({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
        positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  )
}

export default function AdminAnalyticsPage(): React.ReactElement {
  const [data, setData] = useState<MonthData[]>([])
  const [superData, setSuperData] = useState<SuperAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = adminUser && !adminUser.is_staff && !!adminUser.vendor
  const isSuperAdmin = !!adminUser?.is_staff
  const endpoint = isVendor ? "/vendors/me/analytics/" : "/admin/analytics/"

  useEffect(() => {
    let cancelled = false
    Promise.all([
      adminFetch<MonthData[]>(endpoint).catch(() => []),
      isSuperAdmin ? adminFetch<SuperAnalytics>("/admin/analytics/super/").catch(() => null) : Promise.resolve(null),
    ])
      .then(([monthly, superAnalytics]) => {
        if (cancelled) return
        setData(Array.isArray(monthly) ? monthly : [])
        if (superAnalytics) setSuperData(superAnalytics)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [endpoint, isSuperAdmin])

  const totalRevenue = data.reduce((sum, d) => sum + parseFloat(d.revenue || "0"), 0)
  const totalOrders = data.reduce((sum, d) => sum + (d.orders ?? 0), 0)
  const maxRevenue = Math.max(...data.map((d) => parseFloat(d.revenue || "0")), 1)

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Analytics</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">
          {isVendor ? "Your store's revenue over time." : "Platform-wide revenue and order trends."}
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dp-bg-elevated rounded-sm w-48" />
          <div className="h-64 bg-dp-bg-elevated rounded-sm" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-dp-text-tertiary gap-3">
          <TrendingUp size={40} className="opacity-30" />
          <p className="text-[14px]">No revenue data yet. Orders will appear here once placed.</p>
        </div>
      ) : (
        <>
          {isSuperAdmin && superData && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Platform Revenue</p>
                  <p className="font-display text-2xl text-dp-text-primary">${superData.totals.revenue.toLocaleString("en", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1 flex items-center gap-1"><Package size={12} /> Orders</p>
                  <p className="font-display text-2xl text-dp-text-primary">{superData.totals.orders.toLocaleString()}</p>
                </div>
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1 flex items-center gap-1"><Users size={12} /> Users</p>
                  <p className="font-display text-2xl text-dp-text-primary">{superData.totals.users.toLocaleString()}</p>
                </div>
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1 flex items-center gap-1"><Gavel size={12} /> Bids</p>
                  <p className="font-display text-2xl text-dp-text-primary">{superData.totals.bids.toLocaleString()}</p>
                </div>
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Auctions</p>
                  <p className="font-display text-2xl text-dp-text-primary">{superData.totals.auctions.toLocaleString()}</p>
                </div>
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Active Auctions</p>
                  <p className="font-display text-2xl text-dp-text-primary">{superData.totals.active_auctions.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Today Revenue</p>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-3xl text-dp-text-primary">${superData.today.revenue.toFixed(2)}</p>
                    <DeltaPill value={superData.rates.revenue_change_pct_vs_yesterday} />
                  </div>
                </div>
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Today Orders</p>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-3xl text-dp-text-primary">{superData.today.orders}</p>
                    <DeltaPill value={superData.rates.orders_change_pct_vs_yesterday} />
                  </div>
                </div>
                <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-2">Today Bids</p>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-3xl text-dp-text-primary">{superData.today.bids}</p>
                    <DeltaPill value={superData.rates.bids_change_pct_vs_yesterday} />
                  </div>
                </div>
              </div>

              <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-5 flex items-center gap-2">
                  <Activity size={12} />
                  Daily Rates (Last 30 Days)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[680px]">
                    <thead className="border-b border-dp-border">
                      <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                        <th className="text-left px-3 py-2">Day</th>
                        <th className="text-right px-3 py-2">Orders</th>
                        <th className="text-right px-3 py-2">Revenue</th>
                        <th className="text-right px-3 py-2">Bids</th>
                        <th className="text-right px-3 py-2">Max Bid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dp-border">
                      {[...superData.by_day].reverse().map((row) => (
                        <tr key={row.day} className="hover:bg-dp-bg-elevated transition-colors">
                          <td className="px-3 py-2 text-dp-text-primary">{row.day}</td>
                          <td className="px-3 py-2 text-right text-dp-text-secondary">{row.orders}</td>
                          <td className="px-3 py-2 text-right text-dp-text-primary">${row.revenue.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-dp-text-secondary">{row.bids}</td>
                          <td className="px-3 py-2 text-right text-dp-text-primary">${row.max_bid.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-5">
                  All Bidders by Auction Product
                </h2>
                {superData.auction_bidder_breakdown.length === 0 ? (
                  <p className="text-[13px] text-dp-text-tertiary">No auction bids yet.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {superData.auction_bidder_breakdown.map((auction) => (
                      <div key={auction.auction_id} className="border border-dp-border rounded-sm overflow-hidden">
                        <div className="px-4 py-3 bg-dp-bg-elevated border-b border-dp-border flex flex-wrap items-center gap-4 justify-between">
                          <div>
                            <p className="text-[13px] font-semibold text-dp-text-primary">{auction.product_title}</p>
                            <p className="text-[11px] text-dp-text-tertiary">Auction #{auction.auction_id} • Ends: {new Date(auction.ends_at).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-dp-text-secondary">Bids: <strong className="text-dp-text-primary">{auction.total_bids}</strong></span>
                            <span className="text-dp-text-secondary">Unique bidders: <strong className="text-dp-text-primary">{auction.unique_bidders}</strong></span>
                            <span className="text-dp-text-secondary">Current: <strong className="text-dp-text-primary">${auction.current_bid.toFixed(2)}</strong></span>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[12px] min-w-[700px]">
                            <thead className="border-b border-dp-border">
                              <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                                <th className="text-left px-3 py-2">Bidder</th>
                                <th className="text-left px-3 py-2">Email</th>
                                <th className="text-right px-3 py-2">Amount</th>
                                <th className="text-right px-3 py-2">Placed At</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dp-border">
                              {auction.bidders.map((bid) => (
                                <tr key={bid.bid_id} className="hover:bg-dp-bg-elevated transition-colors">
                                  <td className="px-3 py-2 text-dp-text-primary">{bid.bidder_name}</td>
                                  <td className="px-3 py-2 text-dp-text-secondary">{bid.bidder_email}</td>
                                  <td className="px-3 py-2 text-right text-dp-text-primary">${bid.amount.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right text-dp-text-tertiary">{new Date(bid.placed_at).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Total Revenue</p>
              <p className="font-display text-3xl text-dp-text-primary">${totalRevenue.toLocaleString("en", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Total Orders</p>
              <p className="font-display text-3xl text-dp-text-primary">{totalOrders.toLocaleString()}</p>
            </div>
            <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-1">Avg per Order</p>
              <p className="font-display text-3xl text-dp-text-primary">
                ${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00"}
              </p>
            </div>
      </div>

      {/* Bar chart */}
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm p-6">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-dp-text-tertiary mb-5">Monthly Revenue</h2>
            <div className="flex items-end gap-2 h-48 overflow-x-auto">
              {data.map((d) => {
                const pct = (parseFloat(d.revenue) / maxRevenue) * 100
                return (
                  <div key={d.month} className="flex flex-col items-center gap-1.5 min-w-[52px]">
                    <span className="text-[10px] text-dp-text-tertiary">${parseFloat(d.revenue).toFixed(0)}</span>
                    <div className="w-10 bg-dp-accent-cta/20 rounded-t-sm relative overflow-hidden" style={{ height: "160px" }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-dp-accent-cta rounded-t-sm transition-all duration-500"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-dp-text-tertiary text-center leading-tight whitespace-nowrap">{d.month}</span>
                  </div>
                )
              })}
        </div>
      </div>

          {/* Table */}
          <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-dp-border">
                <tr className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                  <th className="text-left px-4 py-3">Month</th>
                  <th className="text-right px-4 py-3">Revenue</th>
                  <th className="text-right px-4 py-3">Orders</th>
                  <th className="text-right px-4 py-3">Avg/Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dp-border">
                {[...data].reverse().map((d) => (
                  <tr key={d.month} className="hover:bg-dp-bg-elevated transition-colors">
                    <td className="px-4 py-3 font-semibold text-dp-text-primary">{d.month}</td>
                    <td className="px-4 py-3 text-right text-dp-text-primary">${parseFloat(d.revenue).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-dp-text-secondary">{d.orders}</td>
                    <td className="px-4 py-3 text-right text-dp-text-tertiary">
                      ${d.orders > 0 ? (parseFloat(d.revenue) / d.orders).toFixed(2) : "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
      </div>
        </>
      )}
    </div>
  )
}
