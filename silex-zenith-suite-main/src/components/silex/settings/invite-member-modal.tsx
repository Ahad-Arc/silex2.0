import React, { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Loader2,
  Copy,
  Check,
  Mail,
  Shield,
  Clock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { createWorkspaceInvitationFn } from "@/lib/server-functions/workspaces";

export interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteCreated?: () => void;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  onInviteCreated,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success view state
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setEmail("");
    setRole("member");
    setError(null);
    setInvitationLink(null);
    setCopied(false);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createWorkspaceInvitationFn({
        data: {
          email: trimmedEmail,
          role,
        },
      });

      // Construct complete shareable link (works in development or production)
      const origin = typeof window !== "undefined" ? window.location.origin : "https://silex.app";
      const fullLink = `${origin}${res.invitationLink}`;
      setInvitationLink(fullLink);

      toast.success("Invitation generated", {
        description: `Invitation link created for ${trimmedEmail}.`,
      });

      if (onInviteCreated) {
        onInviteCreated();
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to create invitation.";
      if (msg.includes("MEMBER_ALREADY_EXISTS")) {
        setError("This user is already an active member of this workspace.");
      } else if (msg.includes("INVITATION_ALREADY_EXISTS")) {
        setError("An active pending invitation has already been issued to this email.");
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitationLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(invitationLink);
      }
      setCopied(true);
      toast.success("Copied to clipboard", {
        description: "Invitation link copied. Share it directly with your teammate.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Could not copy automatically. Please copy the link manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-card/95 backdrop-blur-2xl border-border/70 rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2 text-violet">
            <UserPlus className="h-5 w-5" />
            <DialogTitle className="text-xl font-display">Invite Teammate</DialogTitle>
          </div>
          <DialogDescription className="text-[12.5px] text-muted-foreground">
            Generate a secure, single-use invitation link to onboard a new collaborator to this workspace.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-[12.5px] flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!invitationLink ? (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium block">Teammate Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="colleague@example.com"
                  required
                  className="flex-1 bg-transparent outline-none text-[13px] min-w-0"
                />
              </div>
            </div>

            {/* Role Select */}
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium block">Assigned Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("member")}
                  className={`p-3 rounded-2xl border text-left transition ${
                    role === "member"
                      ? "border-violet bg-violet/10 text-foreground"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">Member</span>
                    {role === "member" && <Check className="h-4 w-4 text-violet" />}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-1">
                    Standard access to projects, tasks, CRM, and documents.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`p-3 rounded-2xl border text-left transition ${
                    role === "admin"
                      ? "border-violet bg-violet/10 text-foreground"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">Admin</span>
                    {role === "admin" && <Check className="h-4 w-4 text-violet" />}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-1">
                    Can manage team members, workspace settings, and branding.
                  </p>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-2xl border border-border/50 bg-card/40 flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-violet shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-muted-foreground">
                Invitations expire automatically after 7 days. Once created, you will receive a single-use shareable link.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-border/50 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
                className="rounded-xl text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl text-[13px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Link…
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Generate Invitation Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Link Generated Success View */
          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[12.5px] flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Invitation created for <strong>{email}</strong> ({role.toUpperCase()})</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Shareable Invitation Link</label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-background focus-within:border-violet/60 transition">
                <input
                  type="text"
                  readOnly
                  value={invitationLink}
                  className="flex-1 bg-transparent text-[12px] font-mono outline-none select-all min-w-0"
                />
                <Button
                  size="sm"
                  onClick={handleCopyLink}
                  className="rounded-lg h-8 px-3 text-[12px] shrink-0 bg-violet hover:bg-violet/90 text-white"
                >
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-2xl border border-border/50 bg-card/40 text-[11.5px] text-muted-foreground space-y-1">
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet" />
                Zero-Cost Workflow ($0 Student Setup)
              </div>
              <p>
                Share this link directly via Slack, WhatsApp, or chat. When your teammate opens it, they will be prompted to sign up or log in to join your workspace.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={() => handleClose(false)}
                className="w-full rounded-xl text-[13px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
