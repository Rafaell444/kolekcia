"use client"

import React from "react"

type GoogleAuthButtonProps = {
  label?: string
  onClick?: () => void
}

export default function GoogleAuthButton({
  label = "Continue with Google",
  onClick,
}: GoogleAuthButtonProps): React.ReactElement {
  function handleClick() {
    if (onClick) {
      onClick()
      return
    }
    // Backend OAuth will be wired later.
    window.alert("Google sign-in is coming soon.")
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center justify-center gap-3 w-full py-3.5 bg-white hover:bg-neutral-50 border border-dp-border rounded-sm text-[13px] font-semibold text-neutral-800 transition-colors shadow-sm"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-5.522 0-10-4.478-10-10s4.478-10 10-10c2.837 0 5.386 1.175 7.226 3.07l5.657-5.657C33.64 10.053 29.082 8 24 8 12.955 8 4 16.955 4 28s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.837 0 5.386 1.175 7.226 3.07l5.657-5.657C33.64 10.053 29.082 8 24 8 16.318 8 9.656 12.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 48c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 39.091 26.715 40 24 40c-5.052 0-9.61-3.317-11.277-7.946l-6.522 5.025C9.505 43.556 16.227 48 24 48z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 41.205 44 36 44 28c0-1.341-.138-2.65-.389-3.917z" />
      </svg>
      {label}
    </button>
  )
}
