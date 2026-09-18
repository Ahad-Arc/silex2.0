import { useEffect, useState } from "react";
import { Plus, MoreVertical, Edit2, History, Trash2, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  getAutomationRulesFn,
  toggleAutomationRuleFn,
  deleteAutomationRuleFn,
  type AutomationRuleItem,
} from "@/lib/server-functions/automation";
import { RuleBuilderDrawer } from "./rule-builder-drawer";

interface AutomationRulesTabProps {
  onViewRuleHistory: (ruleId: string) => void;
}

export function AutomationRulesTab({ onViewRuleHistory }: AutomationRulesTabProps) {
  const [rules, setRules] = useState<AutomationRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRuleItem | null>(null);

  const [ruleToDelete, setRuleToDelete] = useState<AutomationRuleItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadRules() {
    setLoading(true);
    setError(null);
    try {
      const res = await getAutomationRulesFn({ data: {} });
      setRules(res.rules);
    } catch (err: any) {
      setError(err.message || "Failed to load automation rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function handleToggleRule(rule: AutomationRuleItem, nextState: boolean) {
    // Optimistic state update
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, isEnabled: nextState } : r))
    );

    try {
      await toggleAutomationRuleFn({
        data: { ruleId: rule.id, isEnabled: nextState },
      });
      toast.success(
        `Rule "${rule.name}" ${nextState ? "enabled" : "disabled"} successfully.`
      );
    } catch (err: any) {
      // Rollback on error
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isEnabled: !nextState } : r))
      );
      toast.error(`Failed to toggle rule: ${err.message || "Unauthorized"}`);
    }
  }

  async function handleDeleteRule() {
    if (!ruleToDelete) return;
    setDeleting(true);
    try {
      await deleteAutomationRuleFn({
        data: { ruleId: ruleToDelete.id },
      });
      toast.success(`Rule "${ruleToDelete.name}" deleted.`);
      setRuleToDelete(null);
      await loadRules();
    } catch (err: any) {
      toast.error(`Failed to delete rule: ${err.message || "Unauthorized"}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Automation Rules</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Configure event triggers, payload conditions, and allowlisted side-effect actions.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(null);
            setDrawerOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-float text-[13px] h-9 gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> Create Rule
        </Button>
      </div>

      {/* Content states */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Automation Rules</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadRules}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : rules.length === 0 ? (
        <Card className="p-8 border-border/70 bg-card/60 backdrop-blur-xl text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Zap className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No Automation Rules Configured</h3>
            <p className="text-[12.5px] text-muted-foreground max-w-md mx-auto">
              Automate task status updates, notifications, audit logging, and webhook delivery when domain events fire.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingRule(null);
              setDrawerOpen(true);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-float text-[12.5px] h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Create Your First Rule
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className="p-4 border-border/70 bg-card/70 backdrop-blur-xl hover:border-violet/40 transition space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{rule.name}</span>
                    <Badge variant="outline" className="font-mono text-[11px] bg-background/50">
                      {rule.triggerEvent}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-muted-foreground flex-wrap">
                    <span>
                      {rule.conditions.length} condition{rule.conditions.length === 1 ? "" : "s"}
                    </span>
                    <span>•</span>
                    <span>
                      {rule.actions.length} action{rule.actions.length === 1 ? "" : "s"} (
                      {rule.actions.map((a: any) => a.type).join(", ")})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={rule.isEnabled}
                    onCheckedChange={(next) => handleToggleRule(rule, next)}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingRule(rule);
                          setDrawerOpen(true);
                        }}
                        className="text-[12.5px] gap-2"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit Rule
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onViewRuleHistory(rule.id)}
                        className="text-[12.5px] gap-2"
                      >
                        <History className="h-3.5 w-3.5" /> View Execution History
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setRuleToDelete(rule)}
                        className="text-[12.5px] gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Rule
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Builder Drawer */}
      <RuleBuilderDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        ruleToEdit={editingRule}
        onSuccess={loadRules}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!ruleToDelete} onOpenChange={(o) => !o && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation Rule?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px]">
              Are you sure you want to delete &quot;{ruleToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Rule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
