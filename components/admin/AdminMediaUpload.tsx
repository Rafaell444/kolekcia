"use client"

import React, { useState } from "react"
import { Upload, Play } from "lucide-react"
import { getAdminToken } from "@/lib/admin-auth"

type MediaFolder = "blog" | "hero" | "categories" | "auctions" | "artists" | "cms"

type Props = {
  label: string
  previewUrl: string
  folder: MediaFolder
  accept?: string
  onUploaded: (url: string) => void
  previewClassName?: string
}

export default function AdminMediaUpload({
  label,
  previewUrl,
  folder,
  accept = "image/*,video/*",
  onUploaded,
  previewClassName = "w-40 h-24",
}: Props): React.ReactElement {
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("folder", folder)
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api"
      const token = getAdminToken()
      const res = await fetch(`${base}/admin/media/upload/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) throw new Error("upload failed")
      const data = (await res.json()) as { url: string }
      onUploaded(data.url)
    } catch {
      alert("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const isVideo = previewUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(previewUrl)

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">{label}</label>
      <div className="flex items-center gap-4">
        {previewUrl ? (
          isVideo ? (
            <div className={`relative bg-dp-bg-elevated border border-dp-border rounded-sm overflow-hidden flex items-center justify-center ${previewClassName}`}>
              <video src={previewUrl} className="w-full h-full object-cover" muted />
              <Play size={16} className="absolute text-white/80" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={label} className={`object-cover border border-dp-border rounded-sm ${previewClassName}`} />
          )
        ) : (
          <div className={`bg-dp-bg-elevated border border-dp-border rounded-sm flex items-center justify-center text-dp-text-tertiary ${previewClassName}`}>
            <Upload size={18} />
          </div>
        )}
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-dp-border rounded-sm text-[12px] font-semibold text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
          <Upload size={13} />
          {uploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  )
}
