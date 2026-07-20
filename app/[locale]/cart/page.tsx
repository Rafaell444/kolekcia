import type { Metadata } from "next"
import CartPage from "./CartPage"

export const metadata: Metadata = {
  title: "Cart | Koleqcia",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <CartPage />
}
