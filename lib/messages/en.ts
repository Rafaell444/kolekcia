const en = {
  nav: {
    shop: "Shop",
    artists: "Artists",
    auctions: "Auctions",
    blog: "Blog",
    custom: "Custom",
    about: "About",
    aboutUs: "About Us",
    contact: "Contact Us",
    cart: "Cart",
    login: "Sign In",
    account: "My Account",
    inbox: "Inbox",
    wishlist: "Wishlist",
    awards: "Awards & XP",
    orders: "Order History",
    profile: "Profile & Orders",
    signOut: "Sign Out",
    myOrders: "My Orders",
  },
  common: {
    viewAll: "View All",
    loading: "Loading…",
    save: "Save",
    cancel: "Cancel",
    search: "Search",
    searchProducts: "Search products…",
    results: "results",
    shopNow: "Shop Now",
    close: "Close",
  },
  home: {
    trending: "Trending Now",
  },
  cart: {
    title: "Your Cart",
    empty: "Your cart is empty",
    emptyHint: "Discover our collection of artist-made metal posters.",
    subtotal: "Subtotal",
    items: "items",
    shippingNote: "Shipping and taxes calculated at checkout",
    checkout: "Checkout",
    viewFullCart: "View Full Cart",
    closeCart: "Close cart",
  },
  checkout: {
    title: "Checkout",
  },
  catalog: {
    title: "Catalog",
    allProducts: "All Products",
  },
  footer: {
    tagline:
      "The world's finest metal poster marketplace. Artist-made originals, licensed collections, and custom prints.",
    shop: "Shop",
    company: "Company",
    support: "Support",
    allProducts: "All Products",
    wallpanels: "Wallpanels",
    figures: "Figures",
    custom: "Custom",
    auction: "Auction",
    helpCenter: "Help Center",
    faq: "FAQ",
    shipping: "Shipping",
    returns: "Returns",
    privacy: "Privacy",
    terms: "Terms",
    cookies: "Cookies",
    rights: "All rights reserved.",
    developedBy: "Developed by",
    magneticMount: "Tool-free magnetic mounting",
  },
} as const

/** Same shape as English, but values are any string (locale translations). */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

export default en
export type MessageTree = DeepStringify<typeof en>
