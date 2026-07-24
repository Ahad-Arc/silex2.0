import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Sparkles,
  Bell,
  Settings,
  User,
  Search,
  Plus,
  ChevronsUpDown,
  Command as CommandIcon,
} from "lucide-react";
import { useState } from "react";
import { SilexLogo } from "./logo";
import { AiDock } from "./ai-dock";
import { CommandMenu } from "./command-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/invoices", label: "Invoices", icon: FileText },
  { to: "/app/payments", label: "Payments", icon: CreditCard },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/ai", label: "AI Assistant", icon: Sparkles, accent: true },
];

const SECONDARY = [
  { to: "/app/notifications", label: "Notifications", icon: Bell },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/profile", label: "Profile", icon: User },
];

export function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen w-full bg-background bg-grain">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl lg:flex">
          <div className="px-5 pt-5 pb-4">
            <Link to="/app" className="block">
              <SilexLogo />
            </Link>
          </div>

          {/* Workspace switcher */}
          <div className="px-3">
            <button className="group flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-card/60 px-2.5 py-2 text-left hover:border-violet/50 transition">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet text-primary-foreground text-[11px] font-semibold">
                AS
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">Ariana Studio</span>
                <span className="block truncate text-[11px] text-muted-foreground">Personal · Free trial</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </div>

          {/* Search / command */}
          <div className="px-3 pt-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-2.5 py-2 text-left text-[13px] text-muted-foreground hover:border-violet/50 transition"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">Search or command…</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                <CommandIcon className="h-2.5 w-2.5" />K
              </kbd>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pt-5 pb-3">
            <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Workspace
            </div>
            <ul className="space-y-0.5">
              {NAV.map((item) => {
                const active = isActive(item.to, item.exact);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", item.accent && "text-violet")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.accent && (
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-violet">
                          new
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Account
            </div>
            <ul className="space-y-0.5">
              {SECONDARY.map((item) => {
                const active = isActive(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Upgrade card */}
          <div className="p-3">
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary to-violet p-4 text-primary-foreground shadow-float">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <div className="text-[11px] font-medium uppercase tracking-widest opacity-80">Upgrade</div>
                <div className="mt-1 text-sm font-semibold">SILEX Studio</div>
                <p className="mt-1 text-[11px] opacity-80 leading-relaxed">
                  Unlimited invoices, AI insights, custom domains.
                </p>
                <button className="mt-3 w-full rounded-lg bg-white/15 backdrop-blur px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/25 transition">
                  Upgrade — $19/mo
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
            <div className="flex h-14 items-center gap-3 px-5">
              <button
                onClick={() => setCmdOpen(true)}
                className="lg:hidden grid h-9 w-9 place-items-center rounded-lg border border-border bg-card/60"
              >
                <Search className="h-4 w-4" />
              </button>
              <div className="hidden lg:flex flex-1 items-center gap-2 text-[13px] text-muted-foreground">
                <Link to="/app" className="hover:text-foreground transition">Workspace</Link>
                <span className="opacity-40">/</span>
                <span className="text-foreground font-medium">Overview</span>
              </div>
              <div className="flex-1 lg:hidden" />

              <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-muted-foreground">All systems normal</span>
              </div>

              <Link
                to="/app/invoices/new"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-[13px] font-medium hover:bg-primary/90 transition shadow-float"
              >
                <Plus className="h-3.5 w-3.5" /> New invoice
              </Link>

              <Link to="/app/notifications" className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card/60 hover:border-violet/50 transition">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-violet" />
              </Link>

              <Link to="/app/profile" className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet text-primary-foreground text-[12px] font-semibold hover:scale-105 transition">
                AV
              </Link>
            </div>
          </header>

          <main className="flex-1 min-w-0 px-5 lg:px-8 py-6 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>

      <AiDock />
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
