import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, Users, Calendar, Clock, AlertCircle } from "lucide-react";
import { createTaskFn } from "@/lib/server-functions/projects";

export interface WorkspaceMemberOption {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  members: WorkspaceMemberOption[];
  onTaskCreated?: (newTask: any) => void;
}

export function CreateTaskModal({
  open,
  onOpenChange,
  projectId,
  members = [],
  onTaskCreated,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
    setEstimatedHours("");
    setSelectedAssigneeIds([]);
    setValidationError(null);
  };

  const handleAssigneeToggle = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError("Task title is required.");
      return;
    }

    if (trimmedTitle.length > 255) {
      setValidationError("Task title cannot exceed 255 characters.");
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      const payload: {
        projectId?: string;
        title: string;
        description?: string;
        status: string;
        priority: string;
        dueDate?: string;
        estimatedHours?: number;
        assigneeUserIds?: string[];
      } = {
        projectId: projectId || undefined,
        title: trimmedTitle,
        description: description.trim() || undefined,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        assigneeUserIds: selectedAssigneeIds.length > 0 ? selectedAssigneeIds : undefined,
      };

      const result = await createTaskFn({ data: payload });

      toast.success("Task created successfully");
      resetForm();
      onOpenChange(false);

      if (onTaskCreated) {
        onTaskCreated(result);
      }
    } catch (err: any) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create task in workspace.";
      toast.error(errorMessage);
      setValidationError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          resetForm();
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-6 shadow-float">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-xl font-display text-foreground flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Create New Task
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground">
            Add a new deliverable to this project board.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {validationError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[12.5px] text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-muted-foreground">
              Task Title <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. Design authentication workflow"
              className="rounded-xl text-[13px] bg-background border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
              disabled={isSubmitting}
              maxLength={255}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-muted-foreground">
              Description (Optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key deliverables, acceptance criteria, or technical context..."
              rows={3}
              className="rounded-xl text-[13px] bg-background border-border/70 resize-none focus-visible:ring-1 focus-visible:ring-primary"
              disabled={isSubmitting}
            />
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                <SelectTrigger className="rounded-xl text-[13px] bg-background border-border/70">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border/70 bg-card/95 backdrop-blur">
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-muted-foreground">Priority</label>
              <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                <SelectTrigger className="rounded-xl text-[13px] bg-background border-border/70">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border/70 bg-card/95 backdrop-blur">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date & Estimated Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-xl text-[13px] bg-background border-border/70"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Estimated Hours
              </label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="999"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g. 8"
                className="rounded-xl text-[13px] bg-background border-border/70"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Assignees Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Assignees
            </label>
            {members.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/80 italic">
                No other workspace members available to assign.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1.5 rounded-xl border border-border/60 bg-muted/20">
                {members.map((member) => {
                  const isSelected = selectedAssigneeIds.includes(member.id);
                  const initials = member.fullName
                    ? member.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : member.email.slice(0, 2).toUpperCase();

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleAssigneeToggle(member.id)}
                      disabled={isSubmitting}
                      className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] transition cursor-pointer border ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                          : "border-border/60 bg-card hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary to-violet text-[9.5px] font-semibold text-primary-foreground">
                        {initials}
                      </span>
                      <span className="truncate max-w-[130px]">{member.fullName || member.email}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="rounded-xl text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-float"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Task…
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
