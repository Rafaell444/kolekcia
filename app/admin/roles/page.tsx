import { Shield, Check, X } from "lucide-react"

const ROLES = [
  {
    name: "Super Admin",
    description: "Full unrestricted access to all platform settings and data.",
    permissions: { orders: true, users: true, artists: true, products: true, auctions: true, settings: true, roles: true, analytics: true },
  },
  {
    name: "Moderator",
    description: "Can manage content, reviews, and user reports.",
    permissions: { orders: false, users: true, artists: true, products: true, auctions: false, settings: false, roles: false, analytics: false },
  },
  {
    name: "Support",
    description: "Can view orders and respond to inbox messages only.",
    permissions: { orders: true, users: false, artists: false, products: false, auctions: false, settings: false, roles: false, analytics: false },
  },
  {
    name: "Artist Manager",
    description: "Manages artist profiles, payouts, and verifications.",
    permissions: { orders: false, users: false, artists: true, products: true, auctions: true, settings: false, roles: false, analytics: true },
  },
]

const PERM_LABELS = ["orders", "users", "artists", "products", "auctions", "settings", "roles", "analytics"] as const

export default function AdminRolesPage() {
  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-dp-text-primary">Roles & Permissions</h1>
        <p className="text-[13px] text-dp-text-tertiary mt-1">Define what each admin role can access on the platform.</p>
      </div>
      <div className="bg-dp-bg-surface border border-dp-border rounded-sm overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-dp-border bg-dp-bg-elevated">
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">Role</th>
              {PERM_LABELS.map((p) => (
                <th key={p} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary capitalize">{p}</th>
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
                  <td key={p} className="px-3 py-4 text-center">
                    {role.permissions[p]
                      ? <Check size={14} className="text-dp-success mx-auto" />
                      : <X    size={14} className="text-dp-text-tertiary/40 mx-auto" />
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
