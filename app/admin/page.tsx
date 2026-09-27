"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  PanelLeft,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { apiFetch } from "@/lib/api"

type AdminUser = {
  id: number
  name: string
  email: string
  role: "user" | "admin"
  created_at: string
}

type AdminPlan = {
  id?: number
  slug: string
  name: string
  description: string | null
  monthly_price: number | null
  yearly_price: number | null
  yearly_total: number | null
  currency: string
  features: string[] | null
  popular: boolean
  cta: string | null
}

type AdminSection = "overview" | "accounts" | "offers" | "subscriptions" | "analytics" | "logs" | "settings"

const emptyPlan: AdminPlan = {
  slug: "",
  name: "",
  description: "",
  monthly_price: null,
  yearly_price: null,
  yearly_total: null,
  currency: "DZD",
  features: [],
  popular: false,
  cta: "Start trial",
}

const navItems: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "accounts", label: "Accounts", icon: Users },
  { id: "offers", label: "Offers", icon: CreditCard },
  { id: "subscriptions", label: "Subscriptions", icon: WalletCards },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
]

export default function AdminPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [activeSection, setActiveSection] = useState<AdminSection>("overview")
  const [users, setUsers] = useState<AdminUser[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [editingPlan, setEditingPlan] = useState<AdminPlan>(emptyPlan)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) return
    if (user?.role !== "admin") {
      router.replace("/")
      return
    }

    Promise.all([apiFetch("/admin/users"), apiFetch("/admin/plans")])
      .then(async ([usersResponse, plansResponse]) => {
        if (!usersResponse.ok || !plansResponse.ok) throw new Error("Unable to load admin data.")
        const usersData = await usersResponse.json()
        const plansData = await plansResponse.json()
        setUsers(usersData.users)
        setPlans(plansData.plans)
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load admin data."))
      .finally(() => setIsLoading(false))
  }, [isAuthenticated, router, user?.role])

  const updateUser = async (account: AdminUser) => {
    setError(null)
    const response = await apiFetch(`/admin/users/${account.id}`, {
      method: "PATCH",
      skipCsrf: true,
      body: JSON.stringify({ name: account.name, role: account.role }),
    })
    if (!response.ok) {
      const data = await response.json()
      setError(data.message ?? "Unable to update account.")
      return
    }
    setStatus("Account updated.")
  }

  const savePlan = async () => {
    setError(null)
    const isEditing = Boolean(editingPlan.id)
    const response = await apiFetch(isEditing ? `/admin/plans/${editingPlan.id}` : "/admin/plans", {
      method: isEditing ? "PATCH" : "POST",
      skipCsrf: true,
      body: JSON.stringify({
        ...editingPlan,
        features: editingPlan.features ?? [],
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.message ?? "Unable to save offer.")
      return
    }
    setPlans((current) => isEditing
      ? current.map((plan) => plan.id === data.plan.id ? data.plan : plan)
      : [data.plan, ...current])
    setEditingPlan(emptyPlan)
    setStatus("Offer saved.")
  }

  const deletePlan = async (plan: AdminPlan) => {
    if (!plan.id || !window.confirm(`Delete ${plan.name}?`)) return
    const response = await apiFetch(`/admin/plans/${plan.id}`, { method: "DELETE", skipCsrf: true })
    const data = await response.json()
    if (!response.ok) {
      setError(data.message ?? "Unable to delete offer.")
      return
    }
    setPlans((current) => current.filter((item) => item.id !== plan.id))
    setStatus("Offer deleted.")
  }

  const sectionTitle: Record<AdminSection, string> = {
    overview: "Overview",
    accounts: "Accounts",
    offers: "Offers",
    subscriptions: "Subscriptions",
    analytics: "Analytics",
    logs: "Logs",
    settings: "Settings",
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return <main className="min-h-screen bg-background p-8 text-foreground">Checking admin access...</main>
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r border-border bg-card/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-border px-3 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                N
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">NexusVPN</p>
                <p className="text-xs text-muted-foreground">Admin control</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarMenu>
                {navItems.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={activeSection === id}
                      onClick={() => setActiveSection(id)}
                      className="justify-start"
                    >
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-3">
            <a href="/" className="flex items-center justify-center rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Back to site
            </a>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 bg-background">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm md:px-8">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden">
                <PanelLeft className="size-4" />
              </SidebarTrigger>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  NexusVPN control room
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">{sectionTitle[activeSection]}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              {user?.name ?? "Admin"}
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8">
            {error && <p className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {status && <p className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600">{status}</p>}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading admin data...</p>
            ) : activeSection === "overview" ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Registered users</p>
                    <p className="mt-3 text-3xl font-semibold">{users.length}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Offers</p>
                    <p className="mt-3 text-3xl font-semibold">{plans.length}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Featured</p>
                    <p className="mt-3 text-3xl font-semibold">{plans.filter((plan) => plan.popular).length}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="size-4 text-primary" />
                    <h2 className="text-lg font-semibold">Recent ops</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Review the account list and pricing offers from the sidebar to keep the public experience aligned with your business rules.
                  </p>
                </div>
              </div>
            ) : activeSection === "accounts" ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Accounts</h2>
                    <p className="text-sm text-muted-foreground">{users.length} registered accounts</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {users.map((account) => (
                    <div key={account.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="grid gap-3">
                        <input
                          value={account.name}
                          onChange={(event) => setUsers((current) => current.map((item) => item.id === account.id ? { ...item, name: event.target.value } : item))}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{account.email}</span>
                          <select
                            value={account.role}
                            onChange={(event) => setUsers((current) => current.map((item) => item.id === account.id ? { ...item, role: event.target.value as AdminUser["role"] } : item))}
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button type="button" onClick={() => updateUser(account)} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : activeSection === "offers" ? (
              <section className="space-y-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Offers</h2>
                    <p className="text-sm text-muted-foreground">Edit what appears on the public pricing page.</p>
                  </div>
                  <button type="button" onClick={() => setEditingPlan(emptyPlan)} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                    New offer
                  </button>
                </div>

                <div className="grid gap-3">
                  {plans.map((plan) => (
                    <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                      <div>
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">{plan.slug} · {plan.currency}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingPlan({ ...plan, features: plan.features ?? [] })} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                          Edit
                        </button>
                        <button type="button" onClick={() => deletePlan(plan)} className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-muted/30 p-5">
                  <h3 className="font-medium">{editingPlan.id ? "Edit offer" : "Create offer"}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input placeholder="Slug" value={editingPlan.slug} onChange={(event) => setEditingPlan({ ...editingPlan, slug: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <input placeholder="Name" value={editingPlan.name} onChange={(event) => setEditingPlan({ ...editingPlan, name: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <input placeholder="Monthly price" type="number" value={editingPlan.monthly_price ?? ""} onChange={(event) => setEditingPlan({ ...editingPlan, monthly_price: event.target.value ? Number(event.target.value) : null })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <input placeholder="Yearly price" type="number" value={editingPlan.yearly_price ?? ""} onChange={(event) => setEditingPlan({ ...editingPlan, yearly_price: event.target.value ? Number(event.target.value) : null })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <textarea placeholder="Description" value={editingPlan.description ?? ""} onChange={(event) => setEditingPlan({ ...editingPlan, description: event.target.value })} className="min-h-20 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  <input
                    placeholder="Features separated by commas"
                    value={(editingPlan.features ?? []).join(", ")}
                    onChange={(event) => setEditingPlan({ ...editingPlan, features: event.target.value.split(",").map((feature) => feature.trim()).filter(Boolean) })}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editingPlan.popular} onChange={(event) => setEditingPlan({ ...editingPlan, popular: event.target.checked })} />
                      Featured offer
                    </label>
                    <button type="button" onClick={savePlan} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                      Save offer
                    </button>
                  </div>
                </div>
              </section>
            ) : activeSection === "subscriptions" ? (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Active subscriptions</p>
                    <p className="mt-3 text-3xl font-semibold">{users.filter((user) => user.role === "user").length}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Renewals this month</p>
                    <p className="mt-3 text-3xl font-semibold">28</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="mt-3 text-3xl font-semibold">$4.8K</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-4 text-lg font-semibold">Subscription summary</h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2">
                      <span>Starter plan</span>
                      <span className="font-medium text-foreground">12 users</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2">
                      <span>Pro plan</span>
                      <span className="font-medium text-foreground">9 users</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2">
                      <span>Business plan</span>
                      <span className="font-medium text-foreground">7 users</span>
                    </div>
                  </div>
                </div>
              </section>
            ) : activeSection === "analytics" ? (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">New signups</p>
                    <p className="mt-3 text-3xl font-semibold">+18%</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Conversion rate</p>
                    <p className="mt-3 text-3xl font-semibold">7.4%</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Trial activation</p>
                    <p className="mt-3 text-3xl font-semibold">63%</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    <h3 className="text-lg font-semibold">Traffic overview</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This space can be connected to the analytics backend later for live acquisition, growth, and funnel insights.
                  </p>
                </div>
              </section>
            ) : activeSection === "logs" ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-4 text-lg font-semibold">Recent activity</h3>
                  <div className="space-y-3 text-sm">
                    {[
                      ["User signed up", "5 minutes ago", "Success"],
                      ["Offer updated", "23 minutes ago", "Info"],
                      ["Admin password reset", "1 hour ago", "Warning"],
                      ["Plan deleted", "2 hours ago", "Error"],
                    ].map(([action, time, status]) => (
                      <div key={`${action}-${time}`} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/40 px-3 py-2">
                        <div>
                          <p className="font-medium text-foreground">{action}</p>
                          <p className="text-muted-foreground">{time}</p>
                        </div>
                        <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-xl font-semibold">Settings</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add admin-level configuration here once the backend settings endpoints are ready.
                </p>
              </section>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
