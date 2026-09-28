import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
  FolderKanban,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getProjectByIdFn, updateTaskStatusFn } from "@/lib/server-functions/projects";
import { KanbanBoard } from "@/components/silex/projects/kanban-board";
import { TaskItem } from "@/components/silex/projects/task-card";
import { CreateTaskModal, WorkspaceMemberOption } from "@/components/silex/projects/create-task-modal";
import { TaskDetailSheet } from "@/components/silex/projects/task-detail-sheet";

export const Route = createFileRoute("/app/projects/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Project ${params.id} — SILEX` },
      { name: "description", content: "Project details, timeline, and task Kanban board." },
    ],
  }),
  component: ProjectDetail,
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

interface ProjectData {
  project: {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    status: string;
    budgetCents: number;
    startDate: string | null;
    dueDate: string | null;
    createdAt: string;
  };
  client: {
    id: string;
    companyName: string;
  } | null;
  members?: WorkspaceMemberOption[];
  tasks: TaskItem[];
}

function ProjectDetail() {
  const { id } = Route.useParams();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await getProjectByIdFn({ data: { projectId: id } });
      if (res) {
        setProjectData(res);
      } else {
        setErrorMsg("Project not found in authorized workspace.");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load project from workspace database."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      setIsUpdatingStatus(true);
      const result = await updateTaskStatusFn({
        data: {
          taskId,
          status: newStatus,
        },
      });

      if (result) {
        toast.success(`Task status updated to ${newStatus.replace("_", " ")}`);

        // Update task status in local state optimistically
        setProjectData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: result.status,
                    completedAt: result.completedAt,
                    updatedAt: result.updatedAt,
                  }
                : t
            ),
          };
        });

        // Also sync selectedTask if currently opened
        setSelectedTask((prev) => {
          if (!prev || prev.id !== taskId) return prev;
          return {
            ...prev,
            status: result.status,
            completedAt: result.completedAt,
            updatedAt: result.updatedAt,
          };
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update task status."
      );
      // Reload on error to ensure sync
      loadProject();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const project = projectData?.project;
  const client = projectData?.client;
  const tasks = projectData?.tasks || [];

  const initials = project?.name
    ? project.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "PR";

  return (
    <div className="space-y-6 stagger">
      {/* Navigation link */}
      <Link
        to="/app/projects"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-[13px]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading project details…
        </div>
      ) : errorMsg || !project ? (
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <div className="text-base font-medium">{errorMsg || "Project not found"}</div>
          <p className="text-[12px] text-muted-foreground">
            The requested project could not be loaded or does not belong to your authorized workspace.
          </p>
          <Link
            to="/app/projects"
            className="inline-block text-[13px] text-primary underline hover:text-primary/90"
          >
            Return to Projects Directory
          </Link>
        </div>
      ) : (
        <>
          {/* Project Header Card */}
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-6">
            <div className="absolute inset-x-0 top-0 h-32 bg-aurora opacity-70" />
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-lg font-semibold shadow-float">
                  {initials}
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-display tracking-tight text-foreground">
                      {project.name}
                    </h1>
                    {project.code && (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground uppercase">
                        {project.code}
                      </span>
                    )}
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                        statusToneMap[project.status] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {project.status.replace("_", " ")}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                      <span>{client?.companyName || "Internal Project"}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                      <span className="tabular-nums font-medium text-foreground">
                        ${(project.budgetCents / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-[11px] text-muted-foreground">budget</span>
                    </div>

                    {project.startDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                        <span>
                          Start:{" "}
                          {new Date(project.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}

                    {project.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                        <span>
                          Due:{" "}
                          {new Date(project.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kanban Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" /> Task Board
              </h2>
              <p className="text-[12.5px] text-muted-foreground">
                Manage deliverables across canonical task workflow statuses.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-[13px] font-medium hover:bg-primary/90 transition shadow-float"
            >
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          </div>

          {/* Kanban Board */}
          <KanbanBoard
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onSelectTask={(task) => setSelectedTask(task)}
            isUpdating={isUpdatingStatus}
          />

          {/* Create Task Modal */}
          <CreateTaskModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            projectId={project.id}
            members={projectData?.members || []}
            onTaskCreated={() => {
              loadProject();
            }}
          />

          {/* Task Detail Sheet */}
          <TaskDetailSheet
            task={selectedTask}
            open={!!selectedTask}
            onOpenChange={(open) => {
              if (!open) setSelectedTask(null);
            }}
            members={projectData?.members || []}
            onTaskUpdated={(updatedTask) => {
              setSelectedTask(updatedTask);
              setProjectData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  tasks: prev.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
                };
              });
            }}
            onTaskDeleted={(deletedTaskId) => {
              setSelectedTask(null);
              setProjectData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  tasks: prev.tasks.filter((t) => t.id !== deletedTaskId),
                };
              });
            }}
            onStatusChange={handleStatusChange}
          />
        </>
      )}
    </div>
  );
}
