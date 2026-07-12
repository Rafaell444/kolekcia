import { Shield, Check, X } from "lucide-react"

const PERM_LABELS = [
  "products", "orders", "customOrders", "auctions", "shipping",
  "customers", "analytics", "inbox", "settings",
  "users", "artists", "gamification", "content", "vendors", "pages", "logs",
] as const

const ROLES = [
  {
    name: "Superadmin",
    description: "Full unrestricted access to all platform settings, content, vendors, and logs.",
    permissions: Object.fromEntries(PERM_LABELS.map((p) => [p, true])) as Record<typeof PERM_LABELS[number], boolean>,
  },
  {
    name: "Vendor 1 — Panel Studio",
    description: "Wallpanels vendor (vendor1@kolekcia.com). Own products, orders, shipping, and store settings only.",
    permissions: {
      products: true, orders: true, customOrders: true, auctions: true, shipping: true,
      customers: true, analytics: true, inbox: true, settings: true,
      users: false, artists: false, gamification: false, content: false, vendors: false, pages: false, logs: false,
    } as Record<typeof PERM_LABELS[number], boolean>,
  },
  {
    name: "Vendor 2 — Figure Studio",
    description: "Figures vendor (vendor2@kolekcia.com). Same vendor-scoped access for the figures catalog.",
    permissions: {
      products: true, orders: true, customOrders: true, auctions: true, shipping: true,
      customers: true, analytics: true, inbox: true, settings: true,
      users: false, artists: false, gamification: false, content: false, vendors: false, pages: false, logs: false,
    } as Record<typeof PERM_LABELS[number], boolean>,
  },
]

const LABEL_DISPLAY: Record<typeof PERM_LABELS[number], string> = {
  products: "Products",
  orders: "Orders",
  customOrders: "Custom",
  auctions: "Auctions",
  shipping: "Shipping",
  customers: "Customers",
  analytics: "Analytics",
  inbox: "Inbox",
  settings: "Settings",
  users: "Users",
  artists: "Artists",
  gamification: "XP",
  content: "Content",
  vendors: "Vendors",
  pages: "Pages",
  logs: "Logs",
}

export default function AdminRolesPage() {
  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-dp-text-primary">Roles & Permissions</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">The three real roles on this platform. Vendors only see their own data.</p>
      </div>
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-dp-border bg-dp-bg-elevated">
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Role</th>
              {PERM_LABELS.map((p) => (
                <th key={p} className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
                  {LABEL_DISPLAY[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role.name} className="border-b border-dp-border hover:bg-dp-bg-elevated transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-dp-accent-cta shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold text-dp-text-primary">{role.name}</p>
                      <p className="text-[11px] text-dp-text-tertiary max-w-xs">{role.description}</p>
                    </div>
                  </div>
                </td>
                {PERM_LABELS.map((p) => (
                  <td key={p} className="px-2 py-4 text-center">
                    {role.permissions[p]
                      ? <Check size={14} className="text-dp-success mx-auto" />
                      : <X size={14} className="text-dp-text-tertiary/40 mx-auto" />
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
