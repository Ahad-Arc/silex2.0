import React from "react";
import {
  Circle,
  Clock,
  Eye,
  CheckCircle2,
  FolderKanban,
  AlertCircle,
} from "lucide-react";
import { TaskCard, TaskItem } from "./task-card";

export interface KanbanBoardProps {
  tasks: TaskItem[];
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  onSelectTask?: (task: TaskItem) => void;
  isUpdating?: boolean;
}

interface ColumnConfig {
  id: "todo" | "in_progress" | "in_review" | "completed";
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  dotClassName: string;
  badgeClassName: string;
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    id: "todo",
    title: "To Do",
    icon: Circle,
    dotClassName: "bg-muted-foreground/60",
    badgeClassName: "bg-muted text-muted-foreground",
  },
  {
    id: "in_progress",
    title: "In Progress",
    icon: Clock,
    dotClassName: "bg-primary",
    badgeClassName: "bg-primary/10 text-primary",
  },
  {
    id: "in_review",
    title: "In Review",
    icon: Eye,
    dotClassName: "bg-warning",
    badgeClassName: "bg-warning/15 text-warning",
  },
  {
    id: "completed",
    title: "Completed",
    icon: CheckCircle2,
    dotClassName: "bg-success",
    badgeClassName: "bg-success/10 text-success",
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onStatusChange,
  onSelectTask,
  isUpdating = false,
}) => {
  // Map/normalize task statuses into canonical columns
  // Legacy 'done' is mapped to 'completed'
  const tasksByColumn = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = [];
    return acc;
  }, {} as Record<string, TaskItem[]>);

  for (const task of tasks) {
    let normalizedStatus = (task.status || "todo").toLowerCase();
    if (normalizedStatus === "done") {
      normalizedStatus = "completed";
    }

    if (tasksByColumn[normalizedStatus]) {
      tasksByColumn[normalizedStatus].push(task);
    } else {
      // Default unknown or fallback status to 'todo'
      tasksByColumn["todo"].push(task);
    }
  }

  const totalTaskCount = tasks.length;

  if (totalTaskCount === 0) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/70 py-16 px-6 text-center space-y-2">
        <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <h3 className="text-base font-medium text-foreground">No tasks created yet</h3>
        <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
          This project doesn't have any tasks assigned to it yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {KANBAN_COLUMNS.map((col) => {
        const columnTasks = tasksByColumn[col.id] || [];
        const IconComponent = col.icon;

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-3xl border border-border/70 bg-card/40 p-4 space-y-3 min-h-[300px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-1 py-0.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dotClassName}`} />
                <h3 className="text-[13px] font-semibold tracking-tight text-foreground uppercase">
                  {col.title}
                </h3>
              </div>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${col.badgeClassName}`}
              >
                {columnTasks.length}
              </span>
            </div>

            {/* Task List */}
            <div className="space-y-3 flex-1">
              {columnTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground/60 min-h-[100px] flex items-center justify-center">
                  No {col.title.toLowerCase()} tasks
                </div>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onSelectTask={onSelectTask}
                    isUpdating={isUpdating}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
