/** ISO 3166-1 alpha-2 codes for flagcdn.com (emoji flags fail on Windows). */
const FLAG_ISO: Record<string, string> = {
  en: "gb",
  ka: "ge",
  ru: "ru",
  USD: "us",
  GEL: "ge",
  EUR: "eu",
  GBP: "gb",
}

export function flagIso(code: string): string {
  return FLAG_ISO[code] ?? code.slice(0, 2).toLowerCase()
}

export default function FlagIcon({
  code,
  size = 16,
  className = "",
}: {
  code: string
  size?: number
  className?: string
}) {
  const iso = flagIso(code)
  const height = Math.round(size * 0.75)

  return (
  // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
      width={size}
      height={height}
      alt=""
      aria-hidden
      className={`inline-block object-cover rounded-[2px] shrink-0 ${className}`}
      style={{ width: size, height }}
    />
  )
}
