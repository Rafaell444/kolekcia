"use client"

import React, { useEffect, useRef } from "react"

type Props = {
  designJson?: Record<string, unknown>
  onChange: (data: { html: string; design: Record<string, unknown> }) => void
}

type GrapesEditor = {
  on: (event: string, cb: () => void) => void
  getHtml: () => string
  getCss: () => string
  setComponents: (components: string) => void
  getProjectData: () => Record<string, unknown>
  loadProjectData: (data: Record<string, unknown>) => void
  destroy: () => void
  runCommand: (id: string) => void
  Panels: {
    getButton: (panel: string, id: string) => { set: (key: string, value: unknown) => void } | null
  }
  BlockManager: {
    getAll: () => { length: number }
    add: (id: string, def: Record<string, unknown>) => void
  }
}

const STARTER_HTML = `
<table data-gjs-type="table" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;">
  <tr>
    <td style="background:#111113;padding:28px 32px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.2em;">
      KOLEQCIA
    </td>
  </tr>
  <tr>
    <td style="padding:32px;color:#636366;font-size:15px;line-height:1.6;">
      <h1 style="margin:0 0 12px;color:#111113;font-size:26px;">Your headline</h1>
      <p style="margin:0 0 20px;">Write your email body here. Drag more blocks from the right panel.</p>
      <a href="https://koleqcia.com" style="display:inline-block;background:#e63946;color:#ffffff;text-decoration:none;padding:14px 28px;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">
        Call to action
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;font-size:12px;color:#aeaeb2;border-top:1px solid #e5e5e7;">
      © Koleqcia · Made in Georgia
    </td>
  </tr>
</table>
`.trim()

function hasProjectData(designJson: Record<string, unknown> | undefined): boolean {
  if (!designJson || Object.keys(designJson).length === 0) return false
  const pages = designJson.pages
  if (Array.isArray(pages) && pages.length > 0) return true
  if (designJson.components != null) return true
  return false
}

export default function EmailEditor({ designJson = {}, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<GrapesEditor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const designAtOpen = useRef(designJson)

  useEffect(() => {
    let cancelled = false
    const design = designAtOpen.current

    async function init() {
      if (!containerRef.current || editorRef.current) return

      const grapesjs = (await import("grapesjs")).default
      await import("grapesjs/dist/css/grapes.min.css")

      let newsletterPlugin: ((editor: unknown, opts?: unknown) => void) | null = null
      try {
        const mod = await import("grapesjs-preset-newsletter")
        newsletterPlugin = (mod.default || mod) as (editor: unknown, opts?: unknown) => void
      } catch {
        /* optional */
      }

      if (cancelled || !containerRef.current) return

      const editor = grapesjs.init({
        container: containerRef.current,
        height: "100%",
        width: "auto",
        storageManager: false,
        fromElement: false,
        noticeOnUnload: false,
        plugins: newsletterPlugin ? [newsletterPlugin] : [],
        pluginsOpts: newsletterPlugin
          ? { "gjs-preset-newsletter": { modalTitleStyle: { "font-weight": "bold" } } }
          : {},
        canvas: {
          styles: [
            "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap",
          ],
        },
        deviceManager: {
          devices: [
            { name: "Desktop", width: "" },
            { name: "Tablet", width: "600px" },
            { name: "Mobile", width: "360px" },
          ],
        },
        // Keep right-side views usable
        blockManager: {
          appendTo: undefined,
        },
      }) as unknown as GrapesEditor

      const openBlocksPanel = () => {
        try {
          const btn = editor.Panels.getButton("views", "open-blocks")
          btn?.set("active", true)
        } catch {
          try {
            editor.runCommand("open-blocks")
          } catch {
            /* ignore */
          }
        }
      }

      const applyContent = () => {
        if (hasProjectData(design)) {
          editor.loadProjectData(design)
        } else {
          // Starter layout so the canvas is never a blank white void
          editor.setComponents(STARTER_HTML)
        }
        openBlocksPanel()
      }

      editor.on("load", () => {
        applyContent()
        window.setTimeout(openBlocksPanel, 100)
      })

      editor.on("update", () => {
        const html = editor.getHtml() + `<style>${editor.getCss()}</style>`
        const project = editor.getProjectData()
        onChangeRef.current({ html, design: project })
      })

      editorRef.current = editor
      applyContent()
    }

    void init()

    return () => {
      cancelled = true
      if (editorRef.current) {
        try {
          editorRef.current.destroy()
        } catch {
          /* ignore */
        }
        editorRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full border border-dp-border rounded-md overflow-hidden bg-[#1e1e1e] email-grapes-host"
      style={{ height: "calc(100vh - 320px)", minHeight: 560 }}
    />
  )
}
