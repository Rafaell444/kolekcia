import type { Metadata } from "next"
import InboxPage from "./InboxPage"

export const metadata: Metadata = {
  title: "Inbox | Koleqcia",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <InboxPage />
}
