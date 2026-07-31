"use client"

import React, { useEffect, useState } from "react"
import { AlertCircle, Upload } from "lucide-react"
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
  const [previewError, setPreviewError] = useState("")

  useEffect(() => {
    setPreviewError("")
  }, [previewUrl])

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(data.detail ?? "Upload failed. Please try again.")
      }
      const data = (await res.json()) as { url: string }
      onUploaded(data.url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const isVideo = Boolean(previewUrl) && /\.(mp4|webm)(\?|$)/i.test(previewUrl)

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-dp-text-tertiary">{label}</label>
      <div className={`flex gap-4 ${isVideo ? "flex-col items-stretch" : "items-center"}`}>
        {previewUrl ? (
          isVideo ? (
            <>
              <div className={`relative bg-black border border-dp-border rounded-sm overflow-hidden flex items-center justify-center ${previewClassName === "w-40 h-24" ? "w-full aspect-video" : previewClassName}`}>
                <video
                  key={previewUrl}
                  src={previewUrl}
                  className="w-full h-full object-contain"
                  muted
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={() => setPreviewError("")}
                  onError={() => setPreviewError("This video cannot be played by the browser. Upload an H.264 MP4 or a WebM file.")}
                />
              </div>
              {previewError && (
                <p role="alert" className="flex items-center gap-2 text-[11px] text-dp-accent-cta">
                  <AlertCircle size={13} className="shrink-0" />
                  {previewError}
                </p>
              )}
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={label} className={`object-cover border border-dp-border rounded-sm ${previewClassName}`} />
          )
        ) : (
          <div className={`bg-dp-bg-elevated border border-dp-border rounded-sm flex items-center justify-center text-dp-text-tertiary ${previewClassName}`}>
            <Upload size={18} />
          </div>
        )}
        <label className="cursor-pointer self-start inline-flex items-center gap-2 px-4 py-2 border border-dp-border rounded-sm text-[12px] font-semibold text-dp-text-secondary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors">
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
