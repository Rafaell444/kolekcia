"use client"

import React, { useEffect, useState } from "react"
import { adminFetch, getAdminUser } from "@/lib/admin-auth"
import { TrendingUp } from "lucide-react"

type MonthData = { month: string; revenue: string; orders: number }

export default function AdminAnalyticsPage(): React.ReactElement {
  const [data, setData] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  const adminUser = typeof window !== "undefined" ? getAdminUser() : null
  const isVendor = adminUser && !adminUser.is_staff && !!adminUser.vendor
  const endpoint = isVendor ? "/vendors/me/analytics/" : "/admin/analytics/"

  useEffect(() => {
    let cancelled = false
    adminFetch<MonthData[]>(endpoint)
      .then((d) => { if (!cancelled) setData(Array.isArray(d) ? d : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [endpoint])

  const totalRevenue = data.reduce((sum, d) => sum + parseFloat(d.revenue || "0"), 0)
  const totalOrders = data.reduce((sum, d) => sum + (d.orders ?? 0), 0)
  const maxRevenue = Math.max(...data.map((d) => parseFloat(d.revenue || "0")), 1)

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">Analytics</h1>
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
