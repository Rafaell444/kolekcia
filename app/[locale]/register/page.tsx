import type { Metadata } from "next"
import RegisterPage from "./RegisterPage"

export const metadata: Metadata = {
  title: "Create Account | Koleqcia",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <RegisterPage />
}
