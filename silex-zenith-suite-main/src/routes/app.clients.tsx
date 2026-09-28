import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Loader2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { getClientsFn, createClientFn } from "@/lib/server-functions/crm";

export const Route = createFileRoute("/app/clients")({
  head: () => ({
    meta: [
      { title: "Clients — SILEX" },
      { name: "description", content: "Every client, one page." },
    ],
  }),
  component: Clients,
});

const toneMap: Record<string, string> = {
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  violet: "bg-violet/10 text-violet",
  muted: "bg-muted text-muted-foreground",
  Active: "bg-success/10 text-success",
  Lead: "bg-violet/10 text-violet",
  Overdue: "bg-destructive/10 text-destructive",
  Paused: "bg-muted text-muted-foreground",
};

interface ClientItem {
  id: string;
  n: string;
  contact: string;
  email: string;
  rev: number;
  invoices: number;
  status: string;
  tone: string;
  g: number;
  since: string;
  isReal?: boolean;
}

function Clients() {
  const [clientsList, setClientsList] = useState<ClientItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("All");

  // Form State
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("Active");

  // Load real clients from server function
  const loadClients = async () => {
    try {
      setIsLoading(true);
      const dbClients = await getClientsFn();

      if (dbClients && dbClients.length > 0) {
        const mapped: ClientItem[] = dbClients.map((c) => ({
          id: c.id,
          n: c.companyName,
          contact: c.primaryContact?.name || "Unassigned",
          email: c.primaryContact?.email || "No email",
          rev: Math.round(((c as any).totalInvoicedCents || 0) / 100),
          invoices: (c as any).invoicesCount || 0,
          status: c.status || "Active",
          tone: c.status === "Overdue" ? "destructive" : c.status === "Lead" ? "violet" : "success",
          g: 0,
          since: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          isReal: true,
        }));
        setClientsList(mapped);
      } else {
        setClientsList([]);
      }
    } catch {
      setClientsList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createClientFn({
        data: {
          companyName: companyName.trim(),
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          website: website.trim() || undefined,
          status,
        },
      });

      toast.success(`Client "${res.client.companyName}" created!`);
      setIsModalOpen(false);

      // Reset form
      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setWebsite("");
      setStatus("Active");

      // Reload clients list
      loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clientsList.filter((c) => {
    const matchesSearch =
      c.n.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "All") return matchesSearch;
    return matchesSearch && c.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Clients</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Every relationship, in one place.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
        >
          <Plus className="h-3.5 w-3.5" /> Add client
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Active", v: `${clientsList.filter((c) => c.status === "Active").length}`, d: "active clients" },
          { l: "Total Clients", v: `${clientsList.length}`, d: "in workspace" },
          { l: "Leads", v: `${clientsList.filter((c) => c.status === "Lead").length}`, d: "sales pipeline" },
          { l: "Pending Action", v: `${clientsList.filter((c) => c.status === "Overdue" || c.status === "Paused").length}`, d: "overdue or paused" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border/70 bg-card/70 p-5 hover-lift">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-display">{s.v}</div>
            <div className="text-[12px] text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 flex-1 min-w-[240px] focus-within:border-violet/60 transition">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients, emails, projects..."
            className="flex-1 bg-transparent outline-none text-[13px]"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
        <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
          {["All", "Active", "Overdue", "Paused"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_100px_120px_40px] gap-3 px-5 py-3 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
          <div>Client</div>
          <div>Contact</div>
          <div className="text-right">Revenue</div>
          <div className="text-center">Invoices</div>
          <div>Status</div>
          <div />
        </div>
        <div className="divide-y divide-border/60">
          {isLoading && clientsList.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading workspace clients…
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-[13px]">
              {clientsList.length === 0
                ? "No clients in this workspace yet. Click \"Add client\" to create your first client."
                : "No clients found matching your filter."}
            </div>
          ) : (
            filteredClients.map((c) => (
              <Link
                key={c.id}
                to="/app/clients/$id"
                params={{ id: c.id }}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_100px_120px_40px] items-center gap-3 px-5 py-4 hover:bg-muted/40 transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-[12px] font-semibold">
                    {c.n
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium flex items-center gap-1.5">
                      {c.n}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      Since {c.since}
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px]">{c.contact}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-medium tabular-nums">
                    ${c.rev.toLocaleString()}
                  </div>
                  <div
                    className={`text-[11px] inline-flex items-center gap-0.5 ${
                      c.g >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {c.g >= 0 ? (
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5" />
                    )}
                    {Math.abs(c.g)}%
                  </div>
                </div>
                <div className="text-center text-[13px] tabular-nums">{c.invoices}</div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      toneMap[c.tone] || toneMap[c.status] || toneMap.muted
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 font-display text-lg">
                <Building2 className="h-5 w-5 text-violet" />
                Add New Client
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="jane@acme.com"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="acme.com"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-violet/60 transition"
                  >
                    <option value="Active">Active</option>
                    <option value="Lead">Lead</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-[13px] font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:bg-primary/90 transition shadow-float disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Client"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
