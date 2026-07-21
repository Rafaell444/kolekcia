"use client"

import React, { useEffect, useRef, useState } from "react"
import { GoogleLogin } from "@react-oauth/google"

type GoogleAuthButtonProps = {
  mode?: "signin" | "signup"
  disabled?: boolean
  onSuccess: (idToken: string) => void | Promise<void>
  onError?: (message: string) => void
}

export default function GoogleAuthButton({
  mode = "signin",
  disabled = false,
  onSuccess,
  onError,
}: GoogleAuthButtonProps): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(Math.max(240, Math.floor(el.clientWidth)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!clientId) return null

  return (
    <div
      ref={containerRef}
      className={`w-full flex justify-center [&>div]:!w-full ${disabled ? "opacity-60 pointer-events-none" : ""}`}
    >
      <GoogleLogin
        onSuccess={(response) => {
          if (response.credential) {
            void onSuccess(response.credential)
            return
          }
          onError?.("Google sign-in failed. Please try again.")
        }}
        onError={() => onError?.("Google sign-in was cancelled or failed.")}
        text={mode === "signup" ? "signup_with" : "signin_with"}
        theme="outline"
        size="large"
        shape="rectangular"
        width={width}
      />
    </div>
  )
}
