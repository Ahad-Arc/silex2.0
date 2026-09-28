import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Loader2,
  Crown,
  Shield,
  User,
  MoreHorizontal,
  Trash2,
  AlertCircle,
  Calendar,
  Briefcase,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  getWorkspaceMembersFn,
  getWorkspaceSettingsFn,
  updateMemberRoleFn,
  removeWorkspaceMemberFn,
} from "@/lib/server-functions/workspaces";
import { useAuth } from "@/lib/supabase";
import { InviteMemberModal } from "./invite-member-modal";

interface MemberItem {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  jobTitle: string | null;
  status: string;
  joinedAt: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export function TeamTab() {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Deactivation confirmation state
  const [memberToDeactivate, setMemberToDeactivate] = useState<MemberItem | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Updating role state
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const loadTeamData = async () => {
    setIsLoading(true);
    try {
      const [membersRes, settingsRes] = await Promise.all([
        getWorkspaceMembersFn({}),
        getWorkspaceSettingsFn({}),
      ]);

      if (membersRes?.members) {
        setMembers(membersRes.members as MemberItem[]);
      }
      if (settingsRes?.userRole) {
        setCurrentUserRole(settingsRes.userRole);
      }
    } catch (err: any) {
      toast.error("Failed to load team roster", {
        description: err?.message || "Please refresh and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  const isOwner = currentUserRole === "owner";
  const isAdmin = currentUserRole === "admin";
  const canManage = isOwner || isAdmin;

  // Active owners count for final-owner protection check in UI
  const activeOwnersCount = members.filter((m) => m.role === "owner" && m.status === "active").length;

  const handleRoleChange = async (member: MemberItem, newRole: "owner" | "admin" | "member") => {
    if (member.role === newRole) return;

    // Frontend pre-flight checks
    if (member.userId === user?.id) {
      toast.error("Action not permitted", {
        description: "You cannot change your own workspace role.",
      });
      return;
    }

    if (isAdmin) {
      if (member.role === "owner") {
        toast.error("Permission denied", {
          description: "Administrators cannot modify workspace owners.",
        });
        return;
      }
      if (member.role === "admin") {
        toast.error("Permission denied", {
          description: "Administrators cannot modify other administrators.",
        });
        return;
      }
      if (newRole === "owner") {
        toast.error("Permission denied", {
          description: "Only workspace owners can promote members to owner.",
        });
        return;
      }
    }

    if (member.role === "owner" && newRole !== "owner" && activeOwnersCount <= 1) {
      toast.error("Final owner protection", {
        description: "The last remaining workspace owner cannot be demoted.",
      });
      return;
    }

    setUpdatingMemberId(member.id);
    try {
      await updateMemberRoleFn({
        data: {
          memberId: member.id,
          role: newRole,
        },
      });

      toast.success("Role updated", {
        description: `${member.user.fullName || member.user.email}'s role updated to ${newRole}.`,
      });

      // Optimistically update or refetch
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)),
      );
    } catch (err: any) {
      toast.error("Failed to update role", {
        description: err?.message || "Server rejected role modification.",
      });
      await loadTeamData();
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!memberToDeactivate) return;

    setIsDeactivating(true);
    try {
      await removeWorkspaceMemberFn({
        data: {
          memberId: memberToDeactivate.id,
        },
      });

      toast.success("Member deactivated", {
        description: `${memberToDeactivate.user.fullName || memberToDeactivate.user.email} was deactivated from the workspace.`,
      });

      setMembers((prev) => prev.filter((m) => m.id !== memberToDeactivate.id));
      setMemberToDeactivate(null);
    } catch (err: any) {
      toast.error("Failed to deactivate member", {
        description: err?.message || "Server rejected member deactivation.",
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name && name.trim()) {
      return name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-violet" />
        <p className="text-[13px] text-muted-foreground">Loading team roster…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-border/60 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display">Team & Members</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-violet/10 text-violet border border-violet/20">
              {members.length}
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Manage your workspace roster, roles, and collaborator access permissions.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setIsInviteModalOpen(true)}
            className="rounded-xl px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm shrink-0"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Teammate
          </Button>
        )}
      </div>

      {/* Members Roster List */}
      <div className="divide-y divide-border/50 border border-border/60 rounded-2xl bg-card/40 overflow-hidden">
        {members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-[13px]">
            No members found in this workspace.
          </div>
        ) : (
          members.map((member) => {
            const isSelf = member.userId === user?.id;
            const isTargetOwner = member.role === "owner";
            const isTargetAdmin = member.role === "admin";

            // Permission logic for role selector
            let canChangeRole = false;
            if (!isSelf) {
              if (isOwner) {
                // Owner can change anyone, except cannot demote final owner
                canChangeRole = !(isTargetOwner && activeOwnersCount <= 1);
              } else if (isAdmin) {
                // Admin can only toggle members between admin and member
                canChangeRole = !isTargetOwner && !isTargetAdmin;
              }
            }

            // Permission logic for deactivation
            let canDeactivate = false;
            if (!isSelf) {
              if (isOwner) {
                canDeactivate = !(isTargetOwner && activeOwnersCount <= 1);
              } else if (isAdmin) {
                canDeactivate = !isTargetOwner && !isTargetAdmin;
              }
            }

            return (
              <div
                key={member.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition"
              >
                {/* Left: Avatar & Identity */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-violet/30 to-primary/20 border border-border/60 grid place-items-center font-semibold text-[13px] text-foreground shadow-sm">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.fullName || member.user.email}
                        className="h-full w-full object-cover rounded-xl"
                      />
                    ) : (
                      getInitials(member.user.fullName, member.user.email)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13.5px] truncate">
                        {member.user.fullName || member.user.email.split("@")[0]}
                      </span>
                      {isSelf && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">{member.user.email}</div>
                  </div>
                </div>

                {/* Right: Job Title, Role Badge, and Actions */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {member.jobTitle && (
                    <span className="hidden md:inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                      <Briefcase className="h-3 w-3" />
                      {member.jobTitle}
                    </span>
                  )}

                  {/* Role Selector or Badge */}
                  {canChangeRole ? (
                    <div className="relative">
                      <select
                        value={member.role}
                        disabled={updatingMemberId === member.id}
                        onChange={(e) =>
                          handleRoleChange(member, e.target.value as "owner" | "admin" | "member")
                        }
                        className="rounded-xl border border-border bg-background/80 px-2.5 py-1 text-[12px] font-medium outline-none focus:border-violet/60 cursor-pointer disabled:opacity-50"
                      >
                        {isOwner && <option value="owner">Owner</option>}
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                      {updatingMemberId === member.id && (
                        <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-2 text-violet" />
                      )}
                    </div>
                  ) : (
                    <div>
                      {member.role === "owner" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11.5px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Crown className="h-3 w-3" /> Owner
                        </span>
                      ) : member.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11.5px] font-medium bg-violet/10 text-violet border border-violet/20">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11.5px] font-medium bg-muted text-muted-foreground border border-border/50">
                          <User className="h-3 w-3" /> Member
                        </span>
                      )}
                    </div>
                  )}

                  {/* Deactivate Button */}
                  {canDeactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMemberToDeactivate(member)}
                      className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      title="Deactivate Member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Invite Modal */}
      <InviteMemberModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        onInviteCreated={loadTeamData}
      />

      {/* Deactivation Confirmation Dialog */}
      <AlertDialog
        open={!!memberToDeactivate}
        onOpenChange={(open) => !open && setMemberToDeactivate(null)}
      >
        <AlertDialogContent className="bg-card/95 backdrop-blur-2xl border-border/70 rounded-3xl p-6 shadow-2xl">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-xl font-display flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Deactivate Team Member?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] text-muted-foreground leading-relaxed">
              Are you sure you want to deactivate{" "}
              <strong className="text-foreground">
                {memberToDeactivate?.user.fullName || memberToDeactivate?.user.email}
              </strong>
              ? They will lose access to this workspace immediately. Their historical task
              contributions, comments, and audit logs will be safely preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-3">
            <AlertDialogCancel
              disabled={isDeactivating}
              className="rounded-xl text-[13px]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeactivating}
              onClick={handleDeactivateConfirm}
              className="rounded-xl text-[13px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deactivating…
                </>
              ) : (
                "Yes, Deactivate Member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
