"use client"

import React, { useEffect, useRef, useCallback } from "react"
import type grapesjs from "grapesjs"

type Props = {
  designJson: Record<string, unknown>
  onChange: (data: { html: string; design: Record<string, unknown> }) => void
}

export default function EmailEditor({ designJson, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<grapesjs.Editor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const initEditor = useCallback(async () => {
    if (!containerRef.current || editorRef.current) return

    const grapesjs = (await import("grapesjs")).default
    await import("grapesjs/dist/css/grapes.min.css")

    let newsletterPlugin: unknown = null
    try {
      const mod = await import("grapesjs-preset-newsletter")
      newsletterPlugin = mod.default || mod
    } catch {
      /* plugin optional */
    }

    const plugins: unknown[] = []
    if (newsletterPlugin) plugins.push(newsletterPlugin)

    const editor = grapesjs.init({
      container: containerRef.current,
      height: "100%",
      width: "auto",
      storageManager: false,
      plugins,
      pluginsOpts: newsletterPlugin
        ? { [newsletterPlugin as string]: {} }
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
    })

    if (designJson && Object.keys(designJson).length > 0) {
      editor.loadProjectData(designJson as ReturnType<typeof editor.getProjectData>)
    }

    editor.on("update", () => {
      const html = editor.getHtml() + `<style>${editor.getCss()}</style>`
      const design = editor.getProjectData() as Record<string, unknown>
      onChangeRef.current({ html, design })
    })

    editorRef.current = editor
  }, [designJson])

  useEffect(() => {
    initEditor()
    return () => {
      if (editorRef.current) {
        editorRef.current.destroy()
        editorRef.current = null
      }
    }
  }, [initEditor])

  return (
    <div
      ref={containerRef}
      className="w-full border border-dp-border rounded-md overflow-hidden"
      style={{ height: "calc(100vh - 320px)", minHeight: 500 }}
    />
  )
}
