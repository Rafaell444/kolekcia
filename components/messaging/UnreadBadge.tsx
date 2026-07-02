export function UnreadBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-dp-accent-cta text-white text-[10px] font-bold leading-none ${className}`}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function notifyInboxRead() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("inbox-read"))
  }
}
