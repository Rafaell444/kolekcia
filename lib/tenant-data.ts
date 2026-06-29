// ============================================================
// KOLEKCIA — Multi-Tenant Data Layer
// Two separate vendor tenants + superadmin aggregation
// ============================================================

export type TenantId = "kolekcia" | "noir"

export type TenantOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"

export type TenantProduct = {
  id: string
  tenantId: TenantId
  title: string
  artistName: string
  imageUrl: string
  price: number
  category: string
  isLimited: boolean
  isSale: boolean
  isNew: boolean
  stock: number
}

export type TenantOrder = {
  id: string
  tenantId: TenantId
  orderNumber: string
  customerName: string
  customerEmail: string
  items: number
  total: number
  status: TenantOrderStatus
  date: string
  createdAt: string
  trackingCode?: string
  product: string
}

export type TenantPayment = {
  id: string
  tenantId: TenantId
  orderNumber: string
  customerName: string
  amount: number
  fee: number
  net: number
  method: "card" | "paypal" | "apple_pay" | "google_pay"
  status: "paid" | "pending" | "refunded" | "failed"
  date: string
}

export type Tenant = {
  id: TenantId
  name: string
  tagline: string
  accentColor: string
  secondaryColor: string
  adminEmail: string
  adminInitials: string
  plan: "starter" | "growth" | "pro"
}

// ── Tenant configs ─────────────────────────────────────────
export const TENANTS: Record<TenantId, Tenant> = {
  kolekcia: {
    id: "kolekcia",
    name: "Kolekcia Prints",
    tagline: "Metal & Canvas Art Posters",
    accentColor: "#e63946",
    secondaryColor: "#e8a427",
    adminEmail: "admin@kolekcia.com",
    adminInitials: "KP",
    plan: "pro",
  },
  noir: {
    id: "noir",
    name: "Noir Studio",
    tagline: "Fine Art Photography Prints",
    accentColor: "#6366f1",
    secondaryColor: "#06b6d4",
    adminEmail: "admin@noirstudio.com",
    adminInitials: "NS",
    plan: "growth",
  },
}

// ── Products ───────────────────────────────────────────────
export const TENANT_PRODUCTS: TenantProduct[] = [
  // Kolekcia products
  { id: "kp1", tenantId: "kolekcia", title: "Neon Dragon",        artistName: "Kaoru Nishida",  imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=560&fit=crop", price: 29.99, category: "Anime",   isLimited: false, isSale: true,  isNew: false, stock: 214 },
  { id: "kp2", tenantId: "kolekcia", title: "Midnight Circuit",   artistName: "Alex Tanaka",    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=560&fit=crop", price: 34.99, category: "Gaming",  isLimited: true,  isSale: false, isNew: false, stock: 42  },
  { id: "kp3", tenantId: "kolekcia", title: "Void Between Stars", artistName: "Selene Varga",   imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=560&fit=crop", price: 34.99, category: "Space",   isLimited: false, isSale: false, isNew: true,  stock: 180 },
  { id: "kp4", tenantId: "kolekcia", title: "Iron Tiger",         artistName: "Marcus Steele",  imageUrl: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&h=560&fit=crop", price: 27.99, category: "Nature",  isLimited: false, isSale: true,  isNew: false, stock: 95  },
  { id: "kp5", tenantId: "kolekcia", title: "Aurora Drift",       artistName: "Hana Kurosawa",  imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=560&fit=crop", price: 49.99, category: "Space",   isLimited: false, isSale: false, isNew: false, stock: 320 },
  // Noir products
  { id: "np1", tenantId: "noir",     title: "Fog & Steel",        artistName: "D. Marchetti",   imageUrl: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&h=560&fit=crop", price: 89.99, category: "Urban",   isLimited: false, isSale: false, isNew: true,  stock: 60  },
  { id: "np2", tenantId: "noir",     title: "Salt Flats Dusk",    artistName: "Ines Moreau",    imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=560&fit=crop", price: 74.99, category: "Landscape",isLimited: true,  isSale: false, isNew: false, stock: 18  },
  { id: "np3", tenantId: "noir",     title: "Tokyo Rain",         artistName: "K. Shimizu",     imageUrl: "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=400&h=560&fit=crop", price: 99.99, category: "Street",  isLimited: false, isSale: true,  isNew: false, stock: 88  },
  { id: "np4", tenantId: "noir",     title: "The Quiet Shore",    artistName: "Ines Moreau",    imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=560&fit=crop", price: 119.99,category: "Seascape",isLimited: false, isSale: false, isNew: false, stock: 44  },
]

// ── Orders ─────────────────────────────────────────────────
export const TENANT_ORDERS: TenantOrder[] = [
  // Kolekcia orders
  { id: "ko1", tenantId: "kolekcia", orderNumber: "KOL-001", customerName: "James Park",    customerEmail: "james@example.com",   items: 2, total: 64.98,  status: "delivered",  date: "2026-06-18", createdAt: "2026-06-18T09:14:00Z", trackingCode: "USPS123456789", product: "Neon Dragon × 2"         },
  { id: "ko2", tenantId: "kolekcia", orderNumber: "KOL-002", customerName: "Mia Hoffman",   customerEmail: "mia@example.com",     items: 1, total: 34.99,  status: "shipped",    date: "2026-06-19", createdAt: "2026-06-19T11:22:00Z", trackingCode: "FEDEX987654",       product: "Midnight Circuit"       },
  { id: "ko3", tenantId: "kolekcia", orderNumber: "KOL-003", customerName: "Tom Fletcher",  customerEmail: "tom@example.com",     items: 3, total: 99.97,  status: "processing", date: "2026-06-20", createdAt: "2026-06-20T14:05:00Z",                                     product: "Iron Tiger × 3"         },
  { id: "ko4", tenantId: "kolekcia", orderNumber: "KOL-004", customerName: "Sofia Reyes",   customerEmail: "sofia@example.com",   items: 1, total: 49.99,  status: "pending",    date: "2026-06-21", createdAt: "2026-06-21T08:30:00Z",                                     product: "Aurora Drift"           },
  { id: "ko5", tenantId: "kolekcia", orderNumber: "KOL-005", customerName: "Yuki Tanaka",   customerEmail: "yuki@example.com",    items: 2, total: 69.98,  status: "delivered",  date: "2026-06-22", createdAt: "2026-06-22T10:18:00Z", trackingCode: "DHL11223344",       product: "Void Between Stars × 2" },
  { id: "ko6", tenantId: "kolekcia", orderNumber: "KOL-006", customerName: "Emma Laurent",  customerEmail: "emma@example.com",    items: 1, total: 29.99,  status: "cancelled",  date: "2026-06-23", createdAt: "2026-06-23T07:55:00Z",                                     product: "Neon Dragon"            },
  // Noir orders
  { id: "no1", tenantId: "noir",     orderNumber: "NOI-001", customerName: "Lucas Brandt",  customerEmail: "lucas@example.com",   items: 1, total: 89.99,  status: "delivered",  date: "2026-06-17", createdAt: "2026-06-17T13:40:00Z", trackingCode: "UPS55667788",       product: "Fog & Steel"            },
  { id: "no2", tenantId: "noir",     orderNumber: "NOI-002", customerName: "Camille Roy",   customerEmail: "camille@example.com", items: 2, total: 169.98, status: "shipped",    date: "2026-06-19", createdAt: "2026-06-19T09:00:00Z", trackingCode: "USPS998877",        product: "Tokyo Rain × 2"         },
  { id: "no3", tenantId: "noir",     orderNumber: "NOI-003", customerName: "Omar Hassan",   customerEmail: "omar@example.com",    items: 1, total: 74.99,  status: "processing", date: "2026-06-20", createdAt: "2026-06-20T16:10:00Z",                                     product: "Salt Flats Dusk"        },
  { id: "no4", tenantId: "noir",     orderNumber: "NOI-004", customerName: "Aiko Mori",     customerEmail: "aiko@example.com",    items: 1, total: 119.99, status: "pending",    date: "2026-06-22", createdAt: "2026-06-22T11:30:00Z",                                     product: "The Quiet Shore"        },
  { id: "no5", tenantId: "noir",     orderNumber: "NOI-005", customerName: "Daniel Kim",    customerEmail: "daniel@example.com",  items: 3, total: 269.97, status: "delivered",  date: "2026-06-23", createdAt: "2026-06-23T08:45:00Z", trackingCode: "FEDEX334455",       product: "Fog & Steel × 3"        },
]

// ── Payments ───────────────────────────────────────────────
export const TENANT_PAYMENTS: TenantPayment[] = [
  // Kolekcia payments
  { id: "kpay1", tenantId: "kolekcia", orderNumber: "KOL-001", customerName: "James Park",   amount: 64.98,  fee: 2.14, net: 62.84,  method: "card",       status: "paid",     date: "2026-06-18" },
  { id: "kpay2", tenantId: "kolekcia", orderNumber: "KOL-002", customerName: "Mia Hoffman",  amount: 34.99,  fee: 1.29, net: 33.70,  method: "paypal",     status: "paid",     date: "2026-06-19" },
  { id: "kpay3", tenantId: "kolekcia", orderNumber: "KOL-003", customerName: "Tom Fletcher", amount: 99.97,  fee: 3.20, net: 96.77,  method: "apple_pay",  status: "pending",  date: "2026-06-20" },
  { id: "kpay4", tenantId: "kolekcia", orderNumber: "KOL-004", customerName: "Sofia Reyes",  amount: 49.99,  fee: 1.74, net: 48.25,  method: "card",       status: "pending",  date: "2026-06-21" },
  { id: "kpay5", tenantId: "kolekcia", orderNumber: "KOL-005", customerName: "Yuki Tanaka",  amount: 69.98,  fee: 2.34, net: 67.64,  method: "google_pay", status: "paid",     date: "2026-06-22" },
  { id: "kpay6", tenantId: "kolekcia", orderNumber: "KOL-006", customerName: "Emma Laurent", amount: 29.99,  fee: 0,    net: 0,      method: "card",       status: "refunded", date: "2026-06-23" },
  // Noir payments
  { id: "npay1", tenantId: "noir",     orderNumber: "NOI-001", customerName: "Lucas Brandt", amount: 89.99,  fee: 2.87, net: 87.12,  method: "card",       status: "paid",     date: "2026-06-17" },
  { id: "npay2", tenantId: "noir",     orderNumber: "NOI-002", customerName: "Camille Roy",  amount: 169.98, fee: 5.27, net: 164.71, method: "paypal",     status: "paid",     date: "2026-06-19" },
  { id: "npay3", tenantId: "noir",     orderNumber: "NOI-003", customerName: "Omar Hassan",  amount: 74.99,  fee: 2.47, net: 72.52,  method: "card",       status: "pending",  date: "2026-06-20" },
  { id: "npay4", tenantId: "noir",     orderNumber: "NOI-004", customerName: "Aiko Mori",    amount: 119.99, fee: 3.72, net: 116.27, method: "apple_pay",  status: "pending",  date: "2026-06-22" },
  { id: "npay5", tenantId: "noir",     orderNumber: "NOI-005", customerName: "Daniel Kim",   amount: 269.97, fee: 8.37, net: 261.60, method: "card",       status: "paid",     date: "2026-06-23" },
]

// ── Helper selectors ───────────────────────────────────────
export function getOrdersForTenant(tenantId: TenantId) {
  return TENANT_ORDERS.filter((o) => o.tenantId === tenantId)
}

export function getPaymentsForTenant(tenantId: TenantId) {
  return TENANT_PAYMENTS.filter((p) => p.tenantId === tenantId)
}

export function getProductsForTenant(tenantId: TenantId) {
  return TENANT_PRODUCTS.filter((p) => p.tenantId === tenantId)
}

export function getTenantRevenue(tenantId: TenantId) {
  return getPaymentsForTenant(tenantId)
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.net, 0)
}
