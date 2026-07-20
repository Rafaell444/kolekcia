import type { Metadata } from "next"
import LoginPage from "./LoginPage"

export const metadata: Metadata = {
  title: "Sign In | Koleqcia",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <LoginPage />
}
