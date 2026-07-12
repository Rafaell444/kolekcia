import Image from "next/image"
import { Gift, Clock } from "lucide-react"
import type { CartItemType } from "@/contexts/cart-context"

type CartItemExtrasProps = {
  item: Pick<CartItemType, "gift_wrap" | "gift_wrap_price" | "gift_wrap_note" | "gift_wrap_image_url" | "processing_option">
  formatPrice: (amount: number | string | null | undefined) => string
  /** Tighter layout for fast cart drawer */
  compact?: boolean
}

export function CartItemExtras({ item, formatPrice, compact = false }: CartItemExtrasProps) {
  const giftWrap = Boolean(item.gift_wrap)
  const wrapPrice = parseFloat(item.gift_wrap_price || "0")
  const processingOption = item.processing_option ?? ""
  const textCls = compact ? "text-[10px]" : "text-[11px]"
  const iconSize = compact ? 10 : 11
  const hasExtras = giftWrap || processingOption

  if (!hasExtras) return null

  return (
    <div className={`flex flex-col gap-0.5 ${compact ? "mt-0.5" : "mt-1.5"}`}>
      {processingOption && (
        <p className={`${textCls} text-dp-text-tertiary flex items-center gap-1`}>
          <Clock size={iconSize} className="shrink-0 text-dp-text-tertiary" aria-hidden />
          <span>
            <span className="font-semibold text-dp-text-secondary">Processing:</span>{" "}
            {processingOption.charAt(0).toUpperCase() + processingOption.slice(1)}
          </span>
        </p>
      )}
      {giftWrap && (
        <div className={`${textCls} text-dp-text-tertiary flex items-start gap-1.5`}>
          <Gift size={iconSize} className="shrink-0 text-dp-text-tertiary mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p>
              <span className="font-semibold text-dp-text-secondary">Gift wrap:</span>{" "}
              <span className="text-dp-accent-gold font-semibold">Yes</span>
              {wrapPrice > 0 && (
                <span className="text-dp-text-secondary"> (+{formatPrice(wrapPrice)})</span>
              )}
            </p>
            {item.gift_wrap_note && (
              <p className="text-dp-text-tertiary truncate">{item.gift_wrap_note}</p>
            )}
            {item.gift_wrap_image_url && (
              <div className={`relative ${compact ? "w-8 h-8" : "w-10 h-10"} rounded-sm overflow-hidden border border-dp-border mt-1`}>
                <Image src={item.gift_wrap_image_url} alt="Gift wrap design" fill className="object-cover" sizes="40px" unoptimized />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
