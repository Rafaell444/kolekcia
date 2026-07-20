import type { Metadata } from "next"
import ForgotPasswordPage from "./ForgotPasswordPage"

export const metadata: Metadata = {
  title: "Reset Password | Koleqcia",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <ForgotPasswordPage />
}
