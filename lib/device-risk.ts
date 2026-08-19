const DEVICE_KEY = "kol_device_risk_id"

export function getDeviceRiskId(): string {
  if (typeof window === "undefined") return ""
  let value = localStorage.getItem(DEVICE_KEY)
  if (!value) {
    value = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_KEY, value)
  }
  return value
}
