"use client"

import React, { useEffect, useState } from "react"
import { Star, CheckCircle, Trash2 } from "lucide-react"
import { adminFetch } from "@/lib/admin-auth"

type Review = {
  id: string; user_email: string; product_title: string
  rating: number; text: string; approved: boolean; created_at: string
}

export default function AdminReviewsPage(): React.ReactElement {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminFetch<Review[]>("/admin/reviews/")
      .then((d) => { if (!cancelled) setReviews(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggleApprove(id: string, approved: boolean) {
    const res = await adminFetch<Review>(`/admin/reviews/${id}/`, { method: "PATCH", body: JSON.stringify({ approved }) }).catch(() => null)
    if (res) setReviews((prev) => prev.map((r) => r.id === id ? { ...r, approved: res.approved } : r))
  }

  async function deleteReview(id: string) {
    await adminFetch(`/admin/reviews/${id}/`, { method: "DELETE" }).catch(() => {})
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">Reviews</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Moderate customer reviews before they go live.</p>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 bg-dp-bg-elevated rounded-sm" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r.id} className={`bg-dp-bg-surface border rounded-sm p-4 ${r.approved ? "border-dp-success/30" : "border-dp-border"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={12} className={s <= r.rating ? "text-dp-accent-gold fill-dp-accent-gold" : "text-dp-text-tertiary"} />
                    ))}
                    <span className="text-[11px] text-dp-text-tertiary ml-1">{r.user_email} on <strong className="text-dp-text-secondary">{r.product_title}</strong></span>
                  </div>
                  <p className="text-[13px] text-dp-text-secondary">{r.text}</p>
                  <p className="text-[11px] text-dp-text-tertiary mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleApprove(r.id, !r.approved)}
                    className={`w-7 h-7 flex items-center justify-center rounded-sm border transition-colors ${r.approved ? "border-dp-success/40 text-dp-success" : "border-dp-border text-dp-text-tertiary hover:text-dp-success hover:border-dp-success/40"}`}
                    aria-label={r.approved ? "Unapprove" : "Approve"}
                  >
                    <CheckCircle size={12} />
                  </button>
                  <button
                    onClick={() => deleteReview(r.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-dp-accent-cta/40 text-dp-accent-cta hover:bg-dp-accent-cta/10 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <p className="text-center py-12 text-dp-text-tertiary">No reviews yet.</p>}
        </div>
      )}
    </div>
  )
}
