import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MoreVertical,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Tag,
  User,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface TaskAssignee {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface TaskTag {
  id: string;
  name: string;
  colorHex?: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  estimatedHours?: number | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  assignees?: TaskAssignee[];
  tags?: TaskTag[];
}

export interface TaskCardProps {
  task: TaskItem;
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  onSelectTask?: (task: TaskItem) => void;
  isUpdating?: boolean;
}

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
  done: "Completed",
};

const priorityStyles: Record<string, { label: string; className: string }> = {
  urgent: {
    label: "Urgent",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  high: {
    label: "High",
    className: "bg-warning/15 text-warning border-warning/20",
  },
  medium: {
    label: "Medium",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  low: {
    label: "Low",
    className: "bg-muted text-muted-foreground border-border/60",
  },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStatusChange,
  onSelectTask,
  isUpdating = false,
}) => {
  const [isMutating, setIsMutating] = useState<boolean>(false);

  const normalizedStatus = task.status === "done" ? "completed" : task.status;
  const priorityInfo =
    priorityStyles[task.priority?.toLowerCase() || ""] || priorityStyles.medium;

  const handleStatusSelect = async (newStatus: string) => {
    if (newStatus === normalizedStatus || isUpdating || isMutating) return;

    try {
      setIsMutating(true);
      await onStatusChange(task.id, newStatus);
    } finally {
      setIsMutating(false);
    }
  };

  const formattedDueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      onClick={() => onSelectTask?.(task)}
      className="group relative rounded-2xl border border-border/70 bg-card/70 p-4 hover:border-violet/40 hover:shadow-md transition-all duration-200 space-y-3 cursor-pointer"
    >
      {/* Header / Priority + Actions */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${priorityInfo.className}`}
        >
          {priorityInfo.label}
        </span>

        {/* Quick Status Action Menu */}
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isUpdating || isMutating}
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/80 hover:text-foreground transition disabled:opacity-50"
            >
              {isMutating ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <>
                  <span className="capitalize">{statusLabels[normalizedStatus] || normalizedStatus}</span>
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-xl border border-border/70 bg-card/95 backdrop-blur">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Move to Status
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { status: "todo", label: "To Do" },
              { status: "in_progress", label: "In Progress" },
              { status: "in_review", label: "In Review" },
              { status: "completed", label: "Completed" },
            ].map((item) => (
              <DropdownMenuItem
                key={item.status}
                onClick={() => handleStatusSelect(item.status)}
                className={`text-[12.5px] cursor-pointer flex items-center justify-between ${
                  normalizedStatus === item.status ? "font-semibold text-primary" : ""
                }`}
              >
                <span>{item.label}</span>
                {normalizedStatus === item.status && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Task Title & Description */}
      <div>
        <h4 className="text-[13.5px] font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {task.title}
        </h4>
        {task.description && (
          <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-md bg-violet/10 px-1.5 py-0.5 text-[10px] text-violet"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer / Meta (Due Date, Estimated Hours, Assignees) */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11.5px] text-muted-foreground">
        <div className="flex items-center gap-3">
          {formattedDueDate && (
            <span className="inline-flex items-center gap-1 text-[11px]" title={`Due: ${formattedDueDate}`}>
              <Calendar className="h-3 w-3 text-muted-foreground/70" />
              {formattedDueDate}
            </span>
          )}

          {task.estimatedHours != null && (
            <span className="inline-flex items-center gap-1 text-[11px]" title={`${task.estimatedHours} hours estimated`}>
              <Clock className="h-3 w-3 text-muted-foreground/70" />
              {task.estimatedHours}h
            </span>
          )}
        </div>

        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 ? (
          <div className="flex items-center -space-x-1.5">
            {task.assignees.slice(0, 3).map((assignee) => {
              const initials = assignee.fullName
                ? assignee.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : assignee.email.slice(0, 2).toUpperCase();

              return (
                <div
                  key={assignee.id}
                  title={assignee.fullName || assignee.email}
                  className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-primary to-violet text-[10px] font-semibold text-primary-foreground ring-2 ring-card shadow-sm"
                >
                  {initials}
                </div>
              );
            })}
            {task.assignees.length > 3 && (
              <div
                className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-card"
                title={`+${task.assignees.length - 3} more`}
              >
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
