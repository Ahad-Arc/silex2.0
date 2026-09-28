import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Key,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Calendar,
  AlertTriangle,
  User,
  Clock,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getApiKeysFn,
  createApiKeyFn,
  revokeApiKeyFn,
  getSecurityOverviewFn,
  type ApiKeyItem,
  type SecurityOverviewResponse,
} from "@/lib/server-functions/security";

export function SecurityTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("member");
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [overview, setOverview] = useState<SecurityOverviewResponse | null>(null);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScope, setSelectedScope] = useState<string>("*");
  const [expiresInDays, setExpiresInDays] = useState<number | null>(90);

  // Reveal Modal State
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Revoke confirmation state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [keysRes, overviewRes] = await Promise.all([
        getApiKeysFn({}),
        getSecurityOverviewFn({}),
      ]);

      setKeys(keysRes.keys || []);
      setUserRole(keysRes.userRole || "member");
      setOverview(overviewRes);
    } catch (err: any) {
      toast.error("Failed to load security settings", {
        description: err?.message || "Please refresh and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const canManage = userRole === "admin" || userRole === "owner";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error("Validation Error", { description: "Please enter a key name." });
      return;
    }

    setIsSubmitting(true);
    try {
      const scopes = selectedScope === "*" ? ["*"] : selectedScope.split(",").map((s) => s.trim());
      const res = await createApiKeyFn({
        data: {
          name: keyName.trim(),
          scopes,
          expiresInDays,
        },
      });

      setKeys((prev) => [res.apiKey, ...prev]);
      setNewlyCreatedKey(res.rawKey);
      setIsCreateOpen(false);
      setKeyName("");
      setSelectedScope("*");
      setExpiresInDays(90);

      toast.success("API key generated", {
        description: "Be sure to copy your key immediately. It will not be shown again.",
      });
    } catch (err: any) {
      toast.error("Creation failed", {
        description: err?.message || "Failed to generate API key.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      await revokeApiKeyFn({
        data: { keyId },
      });

      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success("API key revoked", {
        description: "The API key has been permanently deactivated.",
      });
    } catch (err: any) {
      toast.error("Revocation failed", {
        description: err?.message || "Failed to revoke API key.",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = () => {
    if (!newlyCreatedKey) return;
    navigator.clipboard.writeText(newlyCreatedKey);
    setIsCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-violet" />
        <p className="text-[13px] text-muted-foreground">Loading workspace security…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview & Identity Section */}
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-4">
        <div className="border-b border-border/60 pb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-display">Authentication & Session</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Review your active workspace authentication credentials and permission tier.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-success/30 bg-success/10 text-success text-[11px] font-medium">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Session Active</span>
          </div>
        </div>

        {overview && (
          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                Authenticated User
              </div>
              <div className="text-[13.5px] font-medium truncate">{overview.fullName}</div>
              <div className="text-[12px] text-muted-foreground truncate">{overview.email}</div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                Workspace Role
              </div>
              <div className="text-[13.5px] font-medium capitalize text-violet">
                {overview.workspaceRole}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {canManage ? "Full Administrative Access" : "Standard Member Access"}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                Active Developer Keys
              </div>
              <div className="text-[13.5px] font-medium">{keys.length} Keys Configured</div>
              <div className="text-[12px] text-muted-foreground">Scoped to active workspace</div>
            </div>
          </div>
        )}
      </div>

      {/* Developer API Keys Section */}
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-6">
        <div className="border-b border-border/60 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-display">Developer API Keys</h2>
            <p className="text-[12.5px] text-muted-foreground">
              API keys allow external tools, webhooks, and scripts to access SILEX securely.
            </p>
          </div>
          <div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              disabled={!canManage}
              className="rounded-xl px-4 py-2 text-[12.5px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Generate API Key
            </Button>
          </div>
        </div>

        {!canManage && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[12px] text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Read-only view: Only workspace administrators or owners can generate or revoke API keys.
            </span>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/30 p-10 text-center space-y-2.5">
            <Key className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <div className="text-sm font-medium">No API keys yet</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Generate an API key to connect external automations, custom integrations, or CI/CD pipelines.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background/50 overflow-hidden">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/20 transition"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-[13.5px]">{k.name}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {k.keyPrefix}••••••••
                    </span>
                    {k.isExpired ? (
                      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        Expired
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Scopes: {k.scopes.join(", ")}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Created by {k.createdByName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                    {k.expiresAt && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {new Date(k.expiresAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(k.id)}
                    disabled={revokingId === k.id}
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg text-xs"
                  >
                    {revokingId === k.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="ml-1 sm:hidden">Revoke</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate API Key Modal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-display">Generate API Key</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide a descriptive label and set scope access for this key.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Key Name</label>
              <input
                type="text"
                placeholder="e.g. Zapier Webhooks or Production Sync"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                maxLength={100}
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-violet transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Permission Scope</label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-violet cursor-pointer transition"
              >
                <option value="*">Full Access (*)</option>
                <option value="read">Read Only (read)</option>
                <option value="read,write">Read & Write (read, write)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Expiration Period</label>
              <select
                value={expiresInDays ?? "never"}
                onChange={(e) =>
                  setExpiresInDays(e.target.value === "never" ? null : Number(e.target.value))
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-violet cursor-pointer transition"
              >
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days (Recommended)</option>
                <option value="365">1 Year</option>
                <option value="never">No Expiration (Never)</option>
              </select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate Key"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Raw Key One-Time Reveal Modal */}
      <Dialog
        open={!!newlyCreatedKey}
        onOpenChange={(open) => {
          if (!open) {
            setNewlyCreatedKey(null);
            setIsCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-display flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              API Key Generated
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Copy this API key now. For your security, this key cannot be displayed again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/90 p-2.5">
              <code className="flex-1 font-mono text-xs text-violet select-all break-all">
                {newlyCreatedKey}
              </code>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={copyToClipboard}
                className="shrink-0 h-8 px-2.5 text-xs rounded-lg"
              >
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">{isCopied ? "Copied" : "Copy"}</span>
              </Button>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Keep this key private and store it securely. If compromised, revoke it immediately in this dashboard.
              </span>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              onClick={() => {
                setNewlyCreatedKey(null);
                setIsCopied(false);
              }}
              className="w-full rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              Done & I have saved my key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
