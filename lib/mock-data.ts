// ============================================================
// KOLEKCIA — Mock Data
// ============================================================

// ── Types ─────────────────────────────────────────────────
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"

export type Order = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  items: number
  total: number
  status: OrderStatus
  createdAt: string
  date: string
  trackingCode?: string
}

export type CartItem = {
  productId: string
  title: string
  artistName: string
  imageUrl: string
  size: string
  finish: string
  frame: string
  price: number
  quantity: number
}

export type Conversation = {
  id: string
  customerName: string
  customerEmail: string
  avatarUrl: string
  subject: string
  unread: number
  lastMessageAt: string
  messages: ChatMessage[]
}

export type ChatMessage = {
  id: string
  from: "customer" | "admin"
  text: string
  sentAt: string
  read: boolean
}

// ── Poster sizes / finishes / frames ─────────────────────
export const POSTER_SIZES = [
  { id: "xs", label: "XS (8×11 in)",  surcharge: 0    },
  { id: "s",  label: "S (12×17 in)",  surcharge: 5    },
  { id: "m",  label: "M (18×24 in)",  surcharge: 10   },
  { id: "l",  label: "L (24×32 in)",  surcharge: 20   },
  { id: "xl", label: "XL (36×48 in)", surcharge: 40   },
]

export const POSTER_FINISHES = [
  { id: "matte",  label: "Matte",  surcharge: 0    },
  { id: "gloss",  label: "Gloss",  surcharge: 5    },
  { id: "satin",  label: "Satin",  surcharge: 8    },
  { id: "canvas", label: "Canvas", surcharge: 15   },
]

export const POSTER_FRAMES = [
  { id: "none",   label: "No Frame",   surcharge: 0    },
  { id: "black",  label: "Black",      surcharge: 15   },
  { id: "white",  label: "White",      surcharge: 15   },
  { id: "walnut", label: "Walnut",     surcharge: 25   },
  { id: "gold",   label: "Gold",       surcharge: 30   },
]

// ── Products ──────────────────────────────────────────────
export const PRODUCTS = [
  {
    id: "p1",
    title: "Neon Dragon",
    artistName: "Kaoru Nishida",
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=560&fit=crop",
    price: 29.99,
    originalPrice: 39.99,
    rating: 4.8,
    reviews: 1243,
    isLimited: false,
    isSale: true,
    isNew: false,
    isExclusive: false,
    category: "anime",
    tags: ["Anime", "Dragon", "Neon"],
  },
  {
    id: "p2",
    title: "Midnight Circuit",
    artistName: "Alex Tanaka",
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=560&fit=crop",
    price: 34.99,
    originalPrice: null,
    rating: 4.6,
    reviews: 876,
    isLimited: true,
    isSale: false,
    isNew: false,
    isExclusive: false,
    category: "gaming",
    tags: ["Gaming", "Circuit", "Cyberpunk"],
  },
  {
    id: "p3",
    title: "Void Between Stars",
    artistName: "Selene Varga",
    imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=560&fit=crop",
    price: 34.99,
    originalPrice: null,
    rating: 4.9,
    reviews: 2108,
    isLimited: false,
    isSale: false,
    isNew: true,
    isExclusive: false,
    category: "space",
    tags: ["Space", "Stars", "Galaxy"],
  },
  {
    id: "p4",
    title: "Iron Tiger",
    artistName: "Marcus Steele",
    imageUrl: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&h=560&fit=crop",
    price: 27.99,
    originalPrice: 34.99,
    rating: 4.5,
    reviews: 654,
    isLimited: false,
    isSale: true,
    isNew: false,
    isExclusive: false,
    category: "nature",
    tags: ["Nature", "Tiger", "Wildlife"],
  },
  {
    id: "p5",
    title: "Aurora Drift",
    artistName: "Hana Kurosawa",
    imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=560&fit=crop",
    price: 49.99,
    originalPrice: null,
    rating: 4.9,
    reviews: 3201,
    isLimited: false,
    isSale: false,
    isNew: false,
    isExclusive: true,
    category: "space",
    tags: ["Space", "Aurora", "Northern Lights"],
  },
  {
    id: "p6",
    title: "Cyber Samurai",
    artistName: "Ryo Tanabe",
    imageUrl: "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=400&h=560&fit=crop",
    price: 39.99,
    originalPrice: null,
    rating: 4.7,
    reviews: 987,
    isLimited: true,
    isSale: false,
    isNew: true,
    isExclusive: false,
    category: "anime",
    tags: ["Anime", "Samurai", "Cyberpunk"],
  },
  {
    id: "p7",
    title: "Crystal Forest",
    artistName: "Elara Moon",
    imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=560&fit=crop",
    price: 24.99,
    originalPrice: 29.99,
    rating: 4.4,
    reviews: 432,
    isLimited: false,
    isSale: true,
    isNew: false,
    isExclusive: false,
    category: "nature",
    tags: ["Nature", "Forest", "Fantasy"],
  },
  {
    id: "p8",
    title: "Digital Phantom",
    artistName: "Kai Nomura",
    imageUrl: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&h=560&fit=crop",
    price: 44.99,
    originalPrice: null,
    rating: 4.8,
    reviews: 1567,
    isLimited: false,
    isSale: false,
    isNew: false,
    isExclusive: true,
    category: "gaming",
    tags: ["Gaming", "Digital", "Ghost"],
  },
]

// ── Categories ────────────────────────────────────────────
export const CATEGORIES = [
  { id: "c1", label: "Anime",     slug: "anime",     imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&h=200&fit=crop", count: 45000 },
  { id: "c2", label: "Gaming",    slug: "gaming",    imageUrl: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=200&h=200&fit=crop", count: 38000 },
  { id: "c3", label: "Space",     slug: "space",     imageUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=200&h=200&fit=crop", count: 22000 },
  { id: "c4", label: "Nature",    slug: "nature",    imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=200&h=200&fit=crop", count: 61000 },
  { id: "c5", label: "Abstract",  slug: "abstract",  imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200&h=200&fit=crop", count: 18000 },
  { id: "c6", label: "Movies",    slug: "movies",    imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&h=200&fit=crop", count: 29000 },
  { id: "c7", label: "Music",     slug: "music",     imageUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop", count: 17000 },
  { id: "c8", label: "Fantasy",   slug: "fantasy",   imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&h=200&fit=crop", count: 33000 },
]

// ── Artists ───────────────────────────────────────────────
export const ARTISTS = [
  {
    id: "a1",
    name: "Kaoru Nishida",
    handle: "kaoru_nishida",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=100&fit=crop",
    designs: 142,
    followers: 18400,
    level: 32,
    badge: "Diamond",
    verified: true,
  },
  {
    id: "a2",
    name: "Alex Tanaka",
    handle: "alex_tanaka",
    avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=100&fit=crop",
    designs: 89,
    followers: 9200,
    level: 18,
    badge: "Gold",
    verified: true,
  },
  {
    id: "a3",
    name: "Selene Varga",
    handle: "selene_varga",
    avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=80&h=80&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=100&fit=crop",
    designs: 203,
    followers: 31000,
    level: 45,
    badge: "Diamond",
    verified: true,
  },
  {
    id: "a4",
    name: "Marcus Steele",
    handle: "marcus_steele",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&h=100&fit=crop",
    designs: 57,
    followers: 4800,
    level: 11,
    badge: "Silver",
    verified: false,
  },
  {
    id: "a5",
    name: "Hana Kurosawa",
    handle: "hana_kurosawa",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=100&fit=crop",
    designs: 178,
    followers: 24600,
    level: 39,
    badge: "Platinum",
    verified: true,
  },
  {
    id: "a6",
    name: "Ryo Tanabe",
    handle: "ryo_tanabe",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
    coverUrl: "https://images.unsplash.com/photo-1545566943-86600b05e0a6?w=400&h=100&fit=crop",
    designs: 96,
    followers: 12100,
    level: 22,
    badge: "Gold",
    verified: true,
  },
]

// ── Hero Slides ───────────────────────────────────────────
export const HERO_SLIDES = [
  {
    id: "h1",
    type: "image" as const,
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1440&h=720&fit=crop",
    headline: "ART THAT\nGETS YOU",
    subline: "2.5 million designs from 150K+ independent artists",
    cta: "Shop Now",
    ctaHref: "/catalog",
    accent: "#e63946",
    videoPosterUrl: undefined,
  },
  {
    id: "h2",
    type: "image" as const,
    imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1440&h=720&fit=crop",
    headline: "EXPLORE\nTHE COSMOS",
    subline: "Stunning space art prints from the world's top digital artists",
    cta: "Browse Space",
    ctaHref: "/catalog?category=space",
    accent: "#e8a427",
    videoPosterUrl: undefined,
  },
  {
    id: "h3",
    type: "image" as const,
    imageUrl: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1440&h=720&fit=crop",
    headline: "GAME\nON",
    subline: "Official licensed gaming posters and fan-made originals",
    cta: "Shop Gaming",
    ctaHref: "/catalog?category=gaming",
    accent: "#00b4d8",
    videoPosterUrl: undefined,
  },
  {
    id: "h4",
    type: "video" as const,
    imageUrl: undefined,
    videoPosterUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1440&h=720&fit=crop",
    headline: "LIMITED\nDROPS",
    subline: "Exclusive prints. New releases every Friday at noon.",
    cta: "View Limited Editions",
    ctaHref: "/catalog?filter=limited",
    accent: "#e8a427",
  },
]

// ── Orders ────────────────────────────────────────────────
export const ORDERS: Order[] = [
  { id: "o1", orderNumber: "KOL-2024-001", customerName: "James Park",   customerEmail: "james@example.com",  items: 2, total: 74.98,  status: "delivered",  date: "2024-06-10", createdAt: "2024-06-10T09:14:00Z", trackingCode: "USPS123456789" },
  { id: "o2", orderNumber: "KOL-2024-002", customerName: "Mia Hoffman",  customerEmail: "mia@example.com",    items: 1, total: 34.99,  status: "shipped",    date: "2024-06-11", createdAt: "2024-06-11T11:22:00Z", trackingCode: "FEDEX987654321" },
  { id: "o3", orderNumber: "KOL-2024-003", customerName: "Tom Fletcher", customerEmail: "tom@example.com",    items: 3, total: 119.97, status: "processing", date: "2024-06-12", createdAt: "2024-06-12T14:05:00Z" },
  { id: "o4", orderNumber: "KOL-2024-004", customerName: "Sofia Reyes",  customerEmail: "sofia@example.com",  items: 1, total: 44.99,  status: "pending",    date: "2024-06-13", createdAt: "2024-06-13T08:30:00Z" },
  { id: "o5", orderNumber: "KOL-2024-005", customerName: "Luca Bianchi", customerEmail: "luca@example.com",   items: 2, total: 89.98,  status: "cancelled",  date: "2024-06-13", createdAt: "2024-06-13T16:44:00Z" },
  { id: "o6", orderNumber: "KOL-2024-006", customerName: "Yuki Tanaka",  customerEmail: "yuki@example.com",   items: 4, total: 159.96, status: "delivered",  date: "2024-06-08", createdAt: "2024-06-08T10:18:00Z", trackingCode: "DHL112233445" },
  { id: "o7", orderNumber: "KOL-2024-007", customerName: "Emma Laurent", customerEmail: "emma@example.com",   items: 1, total: 29.99,  status: "processing", date: "2024-06-14", createdAt: "2024-06-14T07:55:00Z" },
  { id: "o8", orderNumber: "KOL-2024-008", customerName: "Daniel Kim",   customerEmail: "daniel@example.com", items: 2, total: 79.98,  status: "shipped",    date: "2024-06-14", createdAt: "2024-06-14T13:40:00Z", trackingCode: "UPS556677889" },
]

// ── Auctions ──────────────────────────────────────────────
export const AUCTIONS = [
  {
    id: "au1",
    title: "Celestial Guardian #1",
    artistName: "Selene Varga",
    imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=840&fit=crop",
    startingBid: 100,
    currentBid: 342,
    bidCount: 18,
    topBidder: "collector_x91",
    endsAt: new Date(Date.now() + 7 * 3600 * 1000 + 23 * 60 * 1000).toISOString(),
    isLive: true,
  },
  {
    id: "au2",
    title: "Ghost in the Chrome",
    artistName: "Kaoru Nishida",
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=840&fit=crop",
    startingBid: 80,
    currentBid: 210,
    bidCount: 11,
    topBidder: "neon_hawk",
    endsAt: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
    isLive: false,
  },
  {
    id: "au3",
    title: "Quantum Bloom",
    artistName: "Hana Kurosawa",
    imageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=840&fit=crop",
    startingBid: 150,
    currentBid: 150,
    bidCount: 0,
    topBidder: "—",
    endsAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    isLive: false,
  },
]

// ── Conversations ─────────────────────────────────────────
export const CONVERSATIONS: Conversation[] = [
  {
    id: "conv1",
    customerName: "James Park",
    customerEmail: "james@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face",
    subject: "Order ORD-001 — frame arrived damaged",
    unread: 2,
    lastMessageAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    messages: [
      { id: "m1", from: "customer", text: "Hi, my frame arrived damaged. There's a crack along the top edge.", sentAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), read: true },
      { id: "m2", from: "admin",    text: "Hi James, I'm so sorry to hear that. We'll send a replacement immediately. No need to return the damaged one.", sentAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), read: true },
      { id: "m3", from: "customer", text: "Thank you! Will I get a tracking number?", sentAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), read: false },
    ],
  },
  {
    id: "conv2",
    customerName: "Mia Hoffman",
    customerEmail: "mia@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=80&h=80&fit=crop&crop=face",
    subject: "Custom size inquiry",
    unread: 1,
    lastMessageAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    messages: [
      { id: "m1", from: "customer", text: "Do you offer sizes larger than XL? I have a 10-foot wall I'd love to fill.", sentAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), read: false },
    ],
  },
  {
    id: "conv3",
    customerName: "Sofia Reyes",
    customerEmail: "sofia@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face",
    subject: "Coupon not working",
    unread: 0,
    lastMessageAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    messages: [
      { id: "m1", from: "customer", text: "My SUMMER30 coupon says it's expired but the banner says it's still on!", sentAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), read: true },
      { id: "m2", from: "admin",    text: "Apologies Sofia! The campaign was extended — I've manually applied 30% to your cart. Refresh and it should show.", sentAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), read: true },
    ],
  },
]

// ── Reviews ���──────────────────────────────────────────────
export const REVIEWS = [
  { id: "r1", customer: "James Park",  product: "Neon Dragon",         rating: 5, text: "Absolutely stunning. Colors pop so much better than I expected.", date: "2024-06-10", approved: true  },
  { id: "r2", customer: "Mia Hoffman", product: "Aurora Drift",        rating: 4, text: "Great print, shipping was fast. Frame was slightly uneven.", date: "2024-06-11", approved: true  },
  { id: "r3", customer: "Tom Fletcher",product: "Cyber Samurai",       rating: 5, text: "Perfect gift for my brother. He couldn't believe the detail.", date: "2024-06-12", approved: false },
  { id: "r4", customer: "Sofia Reyes", product: "Void Between Stars",  rating: 3, text: "Good quality but the image looks darker than in the preview.", date: "2024-06-13", approved: true  },
  { id: "r5", customer: "Luca Bianchi",product: "Iron Tiger",          rating: 5, text: "Exceeded expectations. Will order again.", date: "2024-06-14", approved: false },
]

// ── Badges ────────────────────────────────────────────────
export const BADGES = [
  { id: "b1", name: "First Purchase",     icon: "🛒", rarity: "common",    description: "Complete your first order.",                   unlocked: true  },
  { id: "b2", name: "Auction Gladiator",  icon: "⚔️", rarity: "rare",     description: "Win your first live auction.",                 unlocked: true  },
  { id: "b3", name: "Collector",          icon: "🖼️", rarity: "common",   description: "Own 10+ posters.",                             unlocked: false },
  { id: "b4", name: "Art Connoisseur",    icon: "🎨", rarity: "epic",     description: "Purchase from 5 different artist categories.", unlocked: false },
  { id: "b5", name: "Review Legend",      icon: "⭐", rarity: "rare",     description: "Submit 20+ verified reviews.",                 unlocked: false },
  { id: "b6", name: "Legendary Patron",   icon: "👑", rarity: "legendary",description: "Spend $1,000+ lifetime.",                     unlocked: false },
  { id: "b7", name: "Referral Champion",  icon: "🤝", rarity: "epic",     description: "Refer 5 friends who complete purchases.",      unlocked: false },
  { id: "b8", name: "Night Owl",          icon: "🦉", rarity: "common",   description: "Make a purchase between midnight and 4am.",    unlocked: true  },
]

// ── Users ─────────────────────────────────────────────────
export const USERS = [
  { id: "u1", name: "James Park",   email: "james@example.com",  role: "customer", orders: 3, xp: 1240, joined: "2023-09-12", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face", banned: false },
  { id: "u2", name: "Mia Hoffman",  email: "mia@example.com",    role: "customer", orders: 1, xp: 320,  joined: "2024-01-05", avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b57b?w=80&h=80&fit=crop&crop=face", banned: false },
  { id: "u3", name: "Tom Fletcher", email: "tom@example.com",    role: "artist",   orders: 7, xp: 4800, joined: "2022-11-20", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=face", banned: false },
  { id: "u4", name: "Sofia Reyes",  email: "sofia@example.com",  role: "customer", orders: 2, xp: 740,  joined: "2024-03-18", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face", banned: false },
  { id: "u5", name: "Luca Bianchi", email: "luca@example.com",   role: "customer", orders: 4, xp: 1900, joined: "2023-05-30", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face", banned: true  },
  { id: "u6", name: "Yuki Tanaka",  email: "yuki@example.com",   role: "artist",   orders: 12,xp: 9200, joined: "2022-04-10", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&crop=face", banned: false },
]
