import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  User,
  Users,
  MessageSquare,
  Edit2,
  Trash2,
  ChevronDown,
  Send,
  X,
  Check,
} from "lucide-react";
import { TaskItem, TaskAssignee, TaskTag } from "./task-card";
import { WorkspaceMemberOption } from "./create-task-modal";
import {
  updateTaskFn,
  updateTaskStatusFn,
  deleteTaskFn,
  getTaskCommentsFn,
  createTaskCommentFn,
  type TaskCommentItem,
} from "@/lib/server-functions/projects";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface TaskDetailSheetProps {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: WorkspaceMemberOption[];
  onTaskUpdated?: (updatedTask: TaskItem) => void;
  onTaskDeleted?: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: string) => Promise<void>;
}

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
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

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  members = [],
  onTaskUpdated,
  onTaskDeleted,
  onStatusChange,
}: TaskDetailSheetProps) {
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editEstimatedHours, setEditEstimatedHours] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Status mutation state
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Deletion state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Comments state
  const [comments, setComments] = useState<TaskCommentItem[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentContent, setNewCommentContent] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // Sync form when task changes
  useEffect(() => {
    if (task) {
      setEditTitle(task.title || "");
      setEditDescription(task.description || "");
      setEditPriority(task.priority?.toLowerCase() || "medium");
      setEditDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
      setEditEstimatedHours(task.estimatedHours != null ? String(task.estimatedHours) : "");
      setEditAssigneeIds(task.assignees ? task.assignees.map((a) => a.id) : []);
      setIsEditing(false);
    }
  }, [task]);

  // Load comments
  const loadComments = useCallback(async () => {
    if (!task) return;
    try {
      setIsLoadingComments(true);
      setCommentsError(null);
      const res = await getTaskCommentsFn({ data: { taskId: task.id } });
      if (res && res.comments) {
        setComments(res.comments);
      }
    } catch (err: any) {
      setCommentsError(
        err instanceof Error ? err.message : "Failed to load task comments."
      );
    } finally {
      setIsLoadingComments(false);
    }
  }, [task?.id]);

  useEffect(() => {
    if (open && task) {
      loadComments();
    }
  }, [open, task?.id, loadComments]);

  // Realtime subscription for task comments
  useEffect(() => {
    if (!open || !task || typeof window === "undefined") {
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const channelName = `comments:${task.id}`;

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_comments",
            filter: `task_id=eq.${task.id}`,
          },
          (payload) => {
            const newRecord = payload.new as Record<string, any>;
            if (newRecord && newRecord.task_id === task.id) {
              // Reload comments to retrieve populated author name
              loadComments();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Fallback gracefully if Supabase client is not fully configured
    }
  }, [open, task?.id, loadComments]);

  if (!task) return null;

  const normalizedStatus = task.status === "done" ? "completed" : task.status;
  const priorityInfo =
    priorityStyles[task.priority?.toLowerCase() || ""] || priorityStyles.medium;

  // Handle status update
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === normalizedStatus || isChangingStatus) return;

    try {
      setIsChangingStatus(true);
      if (onStatusChange) {
        await onStatusChange(task.id, newStatus);
      } else {
        const res = await updateTaskStatusFn({
          data: {
            taskId: task.id,
            status: newStatus,
          },
        });
        toast.success(`Task moved to ${statusLabels[newStatus] || newStatus}`);
        if (onTaskUpdated) {
          onTaskUpdated({
            ...task,
            status: res.status,
            completedAt: res.completedAt,
            updatedAt: res.updatedAt,
          });
        }
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to update task status.");
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Handle edit save
  const handleSaveEdit = async () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      toast.error("Task title cannot be empty.");
      return;
    }

    try {
      setIsSavingEdit(true);
      const res = await updateTaskFn({
        data: {
          taskId: task.id,
          title: trimmedTitle,
          description: editDescription.trim() || null,
          priority: editPriority,
          dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
          estimatedHours: editEstimatedHours ? parseFloat(editEstimatedHours) : null,
          assigneeUserIds: editAssigneeIds,
        },
      });

      // Map assignee user IDs back to full objects
      const updatedAssignees: TaskAssignee[] = (res.assigneeUserIds || []).map((userId) => {
        const member = members.find((m) => m.id === userId);
        return {
          id: userId,
          fullName: member?.fullName || "Member",
          email: member?.email || "",
          avatarUrl: member?.avatarUrl || null,
        };
      });

      const updatedTaskItem: TaskItem = {
        ...task,
        title: res.title,
        description: res.description,
        priority: res.priority,
        dueDate: res.dueDate,
        estimatedHours: res.estimatedHours,
        assignees: updatedAssignees,
        updatedAt: res.updatedAt,
      };

      toast.success("Task updated successfully");
      setIsEditing(false);

      if (onTaskUpdated) {
        onTaskUpdated(updatedTaskItem);
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle soft delete
  const handleDeleteTask = async () => {
    try {
      setIsDeleting(true);
      await deleteTaskFn({
        data: {
          taskId: task.id,
        },
      });

      toast.success("Task deleted successfully");
      setIsDeleteDialogOpen(false);
      onOpenChange(false);

      if (onTaskDeleted) {
        onTaskDeleted(task.id);
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle add comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCommentContent.trim();
    if (!trimmed || isSubmittingComment) return;

    try {
      setIsSubmittingComment(true);
      const newComment = await createTaskCommentFn({
        data: {
          taskId: task.id,
          content: trimmed,
        },
      });

      setComments((prev) => [...prev, newComment]);
      setNewCommentContent("");
      toast.success("Comment posted");
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setEditAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto space-y-6 bg-card border-border/80">
          <SheetHeader className="text-left space-y-2 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${priorityInfo.className}`}
                >
                  {priorityInfo.label}
                </span>

                {/* Quick Status Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={isChangingStatus}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:bg-muted/80 transition disabled:opacity-50"
                  >
                    {isChangingStatus ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                      <>
                        <span className="capitalize">
                          {statusLabels[normalizedStatus] || normalizedStatus}
                        </span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-44 rounded-xl border border-border/70 bg-card/95 backdrop-blur"
                  >
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Change Status
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
                        onClick={() => handleStatusChange(item.status)}
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

              {/* Action Buttons: Edit & Delete */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="h-8 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="h-8 px-2 text-[12px] text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {isEditing ? (
              <div className="pt-2 space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Task Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-base font-display rounded-xl bg-background"
                  placeholder="Task title"
                />
              </div>
            ) : (
              <SheetTitle className="text-xl font-display text-foreground leading-snug">
                {task.title}
              </SheetTitle>
            )}
            <SheetDescription className="text-[12px] text-muted-foreground">
              ID: <span className="font-mono text-[11px]">{task.id}</span>
            </SheetDescription>
          </SheetHeader>

          {/* Body: View vs Edit Mode */}
          {isEditing ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  placeholder="Add task description..."
                  className="rounded-xl text-[13px] bg-background resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground">Priority</label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger className="rounded-xl text-[13px] bg-background">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-border/70 bg-card/95 backdrop-blur">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground">Due Date</label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="rounded-xl text-[13px] bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  Estimated Hours
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="999"
                  value={editEstimatedHours}
                  onChange={(e) => setEditEstimatedHours(e.target.value)}
                  placeholder="e.g. 8"
                  className="rounded-xl text-[13px] bg-background"
                />
              </div>

              {/* Assignees Selector */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  Manage Assignees
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded-xl border border-border/60 bg-muted/20">
                  {members.length === 0 ? (
                    <span className="text-[12px] text-muted-foreground italic">
                      No members in workspace.
                    </span>
                  ) : (
                    members.map((member) => {
                      const isSelected = editAssigneeIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleAssignee(member.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[12px] border transition cursor-pointer ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border/60 bg-card hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          <span className="truncate max-w-[120px]">
                            {member.fullName || member.email}
                          </span>
                          {isSelected && <Check className="h-3 w-3 text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSavingEdit}
                  className="rounded-xl text-[12.5px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="rounded-xl text-[12.5px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-float"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </h4>
                <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {task.description || (
                    <span className="text-muted-foreground/70 italic">No description provided.</span>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                <div className="rounded-2xl border border-border/60 bg-card/40 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11.5px]">
                    <Calendar className="h-3.5 w-3.5" /> Due Date
                  </div>
                  <div className="font-medium text-foreground">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No deadline"}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/40 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11.5px]">
                    <Clock className="h-3.5 w-3.5" /> Estimated Hours
                  </div>
                  <div className="font-medium text-foreground">
                    {task.estimatedHours != null ? `${task.estimatedHours} hours` : "Unestimated"}
                  </div>
                </div>

                {task.completedAt && (
                  <div className="rounded-2xl border border-success/30 bg-success/5 p-3 space-y-1 col-span-2">
                    <div className="flex items-center gap-1.5 text-success text-[11.5px]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completed At
                    </div>
                    <div className="font-medium text-foreground">
                      {new Date(task.completedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Assignees */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Assignees
                </h4>
                {task.assignees && task.assignees.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {task.assignees.map((assignee) => {
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
                          className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-1.5"
                        >
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-primary to-violet text-[10px] font-semibold text-primary-foreground">
                            {initials}
                          </span>
                          <div className="text-[12px] leading-tight">
                            <div className="font-medium text-foreground">
                              {assignee.fullName || "Member"}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                              {assignee.email}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground/70 italic">Unassigned</p>
                )}
              </div>

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet/10 px-2.5 py-1 text-[11px] font-medium text-violet border border-violet/20"
                      >
                        <Tag className="h-3 w-3" />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <div>
                  Created:{" "}
                  {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "N/A"}
                </div>
                <div>
                  Updated:{" "}
                  {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "N/A"}
                </div>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="pt-4 border-t border-border/60 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Comments ({comments.length})
              </h4>
            </div>

            {/* Comment Composer */}
            <form onSubmit={handleAddComment} className="space-y-2">
              <Textarea
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                placeholder="Write a comment or status update..."
                rows={2}
                className="rounded-xl text-[12.5px] bg-background resize-none"
                disabled={isSubmittingComment}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingComment || !newCommentContent.trim()}
                  className="rounded-xl text-[12px] bg-primary text-primary-foreground hover:bg-primary/90 h-8 gap-1 shadow-float"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Post Comment
                </Button>
              </div>
            </form>

            {/* Comments List */}
            {isLoadingComments ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-[12px]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading comments…
              </div>
            ) : commentsError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[12px] text-destructive flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{commentsError}</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground/70">
                No comments yet. Start the conversation.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {comments.map((comment) => {
                  const initials = comment.authorName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={comment.id}
                      className="rounded-2xl border border-border/60 bg-card/70 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary to-violet text-[9px] font-semibold text-primary-foreground">
                            {initials}
                          </span>
                          <span className="text-[12px] font-medium text-foreground truncate">
                            {comment.authorName}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-muted-foreground whitespace-nowrap">
                          {new Date(comment.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-foreground/90 whitespace-pre-wrap leading-relaxed pl-7">
                        {comment.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border border-border/80 bg-card p-6 shadow-float">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-display text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Delete Task
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>"{task.title}"</strong>? This deliverable will
              be removed from your active project board. This action can be audited in server logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="rounded-xl text-[13px] bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-float"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Yes, Delete Task"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
