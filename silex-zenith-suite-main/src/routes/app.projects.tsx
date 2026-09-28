import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  FolderKanban,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { getProjectsFn } from "@/lib/server-functions/projects";

export const Route = createFileRoute("/app/projects")({
  head: () => ({
    meta: [
      { title: "Projects — SILEX" },
      { name: "description", content: "Projects, tasks, and deliverables." },
    ],
  }),
  component: Projects,
});

const statusToneMap: Record<string, string> = {
  active: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  planning: "bg-violet/10 text-violet",
  completed: "bg-success/10 text-success",
  Closed: "bg-muted text-muted-foreground",
  on_hold: "bg-warning/15 text-warning",
  draft: "bg-muted text-muted-foreground",
};

interface ProjectItem {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  budgetCents: number;
  clientName: string;
  clientId: string | null;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface ProjectStats {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  totalBudgetCents: number;
}

function Projects() {
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    totalCount: 0,
    activeCount: 0,
    completedCount: 0,
    totalBudgetCents: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("All");

  useEffect(() => {
    async function loadProjects() {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const res = await getProjectsFn();
        if (res) {
          setProjectsList(res.projects);
          setStats(res.stats);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to load projects from workspace database."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, []);

  const filteredProjects = projectsList.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.clientName.toLowerCase().includes(q);

    if (activeTab === "All") return matchesSearch;
    return matchesSearch && p.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display tracking-tight">Projects</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Projects, tasks, and deliverables.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            l: "Total Projects",
            v: `${stats.totalCount}`,
            d: "workspace projects",
          },
          {
            l: "Active Projects",
            v: `${stats.activeCount}`,
            d: "currently in progress",
            tone: "primary",
          },
          {
            l: "Completed",
            v: `${stats.completedCount}`,
            d: "finished projects",
            tone: "success",
          },
          {
            l: "Total Budget",
            v: `$${(stats.totalBudgetCents / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            d: "allocated budget",
          },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border/70 bg-card/70 p-5 hover-lift">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div
              className={`mt-2 text-3xl font-display ${
                s.tone === "success" ? "text-success" : s.tone === "primary" ? "text-primary" : ""
              }`}
            >
              {s.v}
            </div>
            <div className="text-[12px] text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 flex-1 min-w-[240px] focus-within:border-violet/60 transition">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, codes, clients..."
            className="flex-1 bg-transparent outline-none text-[13px]"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-[13px]">
          <Filter className="h-3.5 w-3.5" /> Filter
        </button>
        <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-0.5 text-[12px]">
          {["All", "active", "planning", "completed", "on_hold"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg capitalize transition ${
                activeTab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List Container */}
      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_110px_110px_110px_40px] gap-3 px-5 py-3 border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
          <div>Project</div>
          <div>Client</div>
          <div className="text-right">Budget</div>
          <div>Start Date</div>
          <div>Due Date</div>
          <div>Status</div>
          <div />
        </div>

        <div className="divide-y divide-border/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading workspace projects…
            </div>
          ) : errorMsg ? (
            <div className="flex items-center justify-center py-16 text-destructive text-[13px]">
              <AlertCircle className="h-4 w-4 mr-2" /> {errorMsg}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-[13px] space-y-1">
              <FolderKanban className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <div className="font-medium text-[14px] text-foreground">No projects found</div>
              <div className="text-[12px] text-muted-foreground">
                There are no projects matching your search criteria or filter.
              </div>
            </div>
          ) : (
            filteredProjects.map((p) => (
              <Link
                key={p.id}
                to={`/app/projects/${p.id}` as any}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_110px_110px_110px_40px] items-center gap-3 px-5 py-4 hover:bg-muted/40 transition group"
              >
                {/* Project Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-[12px] font-semibold">
                    {p.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium flex items-center gap-1.5">
                      {p.name}
                      {p.code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                          {p.code}
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <div className="truncate text-[11px] text-muted-foreground">
                        {p.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Client */}
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{p.clientName}</span>
                  </div>
                </div>

                {/* Budget */}
                <div className="text-right text-[13.5px] font-medium tabular-nums">
                  ${(p.budgetCents / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>

                {/* Start Date */}
                <div className="text-[12.5px] text-muted-foreground">
                  {p.startDate
                    ? new Date(p.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </div>

                {/* Due Date */}
                <div className="text-[12.5px] text-muted-foreground">
                  {p.dueDate
                    ? new Date(p.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </div>

                {/* Status */}
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                      statusToneMap[p.status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status.replace("_", " ")}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
