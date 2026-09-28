import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Files,
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
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SilexLogo } from "./logo";
import { AiDock } from "./ai-dock";
import { CommandMenu } from "./command-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/supabase";
import { getNotificationsFn } from "@/lib/server-functions/notifications";
import { getWorkspaceSettingsFn } from "@/lib/server-functions/workspaces";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/documents", label: "Documents", icon: Files },
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
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [workspaceData, setWorkspaceData] = useState<{
    name: string;
    planTier: string;
    logoUrl?: string | null;
  } | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Initial notification count fetch
  useEffect(() => {
    async function loadNotificationStats() {
      try {
        const res = await getNotificationsFn({ data: { unreadOnly: true, limit: 10 } });
        setUnreadCount(res.unreadCount || 0);
      } catch {
        // Safe fallback for unauthenticated / initial loading
      }
    }
    loadNotificationStats();
  }, [pathname]);

  // Load active authenticated workspace info
  useEffect(() => {
    async function loadWorkspaceInfo() {
      try {
        const res = await getWorkspaceSettingsFn({});
        if (res?.workspace) {
          setWorkspaceData({
            name: res.workspace.name,
            planTier: res.workspace.planTier,
            logoUrl: res.workspace.logoUrl,
          });
        }
      } catch {
        // Safe fallback for unauthenticated / initial loading
      }
    }
    loadWorkspaceInfo();

    const handleWorkspaceUpdate = (e: any) => {
      if (e.detail?.name) {
        setWorkspaceData((prev) => ({
          name: e.detail.name,
          planTier: e.detail.planTier || prev?.planTier || "free",
          logoUrl: e.detail.logoUrl !== undefined ? e.detail.logoUrl : prev?.logoUrl || null,
        }));
      } else {
        loadWorkspaceInfo();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("silex_workspace_updated", handleWorkspaceUpdate);
      return () => window.removeEventListener("silex_workspace_updated", handleWorkspaceUpdate);
    }
  }, []);

  // Attach Realtime WebSocket listener for live notification pushes
  useRealtimeNotifications({
    recipientUserId: user?.id,
    onNotification: (payload) => {
      if (payload.eventType === "INSERT") {
        setUnreadCount((c) => c + 1);
      } else {
        // Refetch on UPDATE
        getNotificationsFn({ data: { unreadOnly: true, limit: 10 } })
          .then((r) => setUnreadCount(r.unreadCount || 0))
          .catch(() => {});
      }
    },
  });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  // Derive dynamic workspace attributes
  const wsName = workspaceData?.name || "Workspace";
  const wsInitials =
    wsName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "WS";

  const userInitials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "U";

  const rawTier = (workspaceData as any)?.planTier || (workspaceData as any)?.plan || "free";
  const planLabel =
    rawTier === "enterprise"
      ? "Enterprise Plan"
      : rawTier === "pro"
      ? "Pro Plan"
      : "Free Plan";


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
            <Link
              to="/app/settings"
              search={{ tab: "workspace" }}
              className="group flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-card/60 px-2.5 py-2 text-left hover:border-violet/50 transition"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet text-primary-foreground text-[11px] font-semibold">
                {wsInitials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{wsName}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {planLabel}
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
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
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/auth", replace: true });
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition text-left"
                >
                  <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">Sign out</span>
                </button>
              </li>
            </ul>
          </nav>

          {/* Upgrade / Plan card */}
          <div className="p-3">
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary to-violet p-4 text-primary-foreground shadow-float">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <div className="text-[11px] font-medium uppercase tracking-widest opacity-80">
                  {rawTier === "free" ? "Upgrade" : "Plan"}
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {rawTier === "enterprise"
                    ? "Enterprise Scale"
                    : rawTier === "pro"
                    ? "SILEX Studio"
                    : "SILEX Studio"}
                </div>
                <p className="mt-1 text-[11px] opacity-80 leading-relaxed">
                  {rawTier === "free"
                    ? "Unlimited invoices, AI insights, custom domains."
                    : "Unlimited invoices, AI insights, and workspace tools active."}
                </p>
                <Link
                  to="/app/settings"
                  search={{ tab: "billing" }}
                  className="mt-3 block text-center w-full rounded-lg bg-white/15 backdrop-blur px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/25 transition"
                >
                  {rawTier === "free" ? "Upgrade — $19/mo" : "Manage Billing & Plans"}
                </Link>
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
                <Link to="/app" className="hover:text-foreground transition">
                  Workspace
                </Link>
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

              <Link
                to="/app/notifications"
                className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card/60 hover:border-violet/50 transition"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet text-[10px] font-bold text-white px-1 shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/app/profile"
                className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet text-primary-foreground text-[12px] font-semibold hover:scale-105 transition"
              >
                {userInitials}
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
