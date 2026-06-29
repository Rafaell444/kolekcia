"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    // Render a placeholder to avoid layout shift
    return (
      <button
        className="relative flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-tertiary"
        aria-label="Toggle theme"
        disabled
      >
        <span className="w-4 h-4" />
      </button>
    )
  }

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center justify-center w-8 h-8 rounded-sm border border-dp-border text-dp-text-tertiary hover:text-dp-text-primary hover:border-dp-border-hover transition-colors"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun size={15} aria-hidden />
      ) : (
        <Moon size={15} aria-hidden />
      )}
    </button>
  )
}
