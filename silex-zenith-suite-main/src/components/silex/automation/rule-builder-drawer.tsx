import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DOMAIN_EVENT_TYPES, type DomainEventType } from "@/lib/events/types";
import {
  createAutomationRuleFn,
  updateAutomationRuleFn,
  type AutomationRuleItem,
} from "@/lib/server-functions/automation";
import { ConditionBuilder, type ConditionRule } from "./condition-builder";
import { ActionBuilder, type ActionItem } from "./action-builder";

interface RuleBuilderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleToEdit?: AutomationRuleItem | null;
  onSuccess: () => void;
}

export function RuleBuilderDrawer({
  open,
  onOpenChange,
  ruleToEdit,
  onSuccess,
}: RuleBuilderDrawerProps) {
  const isEditing = !!ruleToEdit;
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<DomainEventType>("invoice.paid");
  const [isEnabled, setIsEnabled] = useState(true);
  const [conditions, setConditions] = useState<ConditionRule[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);

  useEffect(() => {
    if (ruleToEdit) {
      setName(ruleToEdit.name);
      setTriggerEvent(ruleToEdit.triggerEvent as DomainEventType);
      setIsEnabled(ruleToEdit.isEnabled);
      setConditions(
        (ruleToEdit.conditions || []).map((c: any) => ({
          fieldPath: c.fieldPath || "event.payload.status",
          operator: c.operator || "eq",
          value: c.value !== undefined ? String(c.value) : "",
        }))
      );
      setActions((ruleToEdit.actions || []) as ActionItem[]);
    } else {
      setName("");
      setTriggerEvent("invoice.paid");
      setIsEnabled(true);
      setConditions([]);
      setActions([
        {
          type: "create_notification",
          recipientUserId: "event.actorId",
          title: "Invoice Paid",
          body: "An invoice total was marked as fully paid.",
        },
      ]);
    }
  }, [ruleToEdit, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a rule name.");
      return;
    }
    if (actions.length === 0) {
      toast.error("At least one allowlisted action is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && ruleToEdit) {
        await updateAutomationRuleFn({
          data: {
            ruleId: ruleToEdit.id,
            name: name.trim(),
            triggerEvent,
            conditions: conditions as any[],
            actions: actions as any[],
            isEnabled,
          },
        });
        toast.success(`Rule "${name}" updated successfully.`);
      } else {
        await createAutomationRuleFn({
          data: {
            name: name.trim(),
            triggerEvent,
            conditions: conditions as any[],
            actions: actions as any[],
            isEnabled,
          },
        });
        toast.success(`Rule "${name}" created successfully.`);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Failed to save automation rule: ${err.message || "Unauthorized or validation error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto space-y-6">
        <SheetHeader>
          <SheetTitle className="text-lg font-display">
            {isEditing ? "Edit Automation Rule" : "Create Automation Rule"}
          </SheetTitle>
          <SheetDescription className="text-[12.5px]">
            Configure trigger conditions and allowlisted side-effect actions.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Rule Name */}
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium text-foreground">Rule Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Notify Team on Invoice Paid"
              required
              className="text-[13px]"
            />
          </div>

          {/* Trigger Event Selection */}
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium text-foreground">Canonical Trigger Event</label>
            <Select
              value={triggerEvent}
              onValueChange={(val) => setTriggerEvent(val as DomainEventType)}
            >
              <SelectTrigger className="text-[13px]">
                <SelectValue placeholder="Select Trigger Event" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_EVENT_TYPES.map((evt) => (
                  <SelectItem key={evt} value={evt} className="text-[12.5px] font-mono">
                    {evt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Directly populated from backend canonical <code>DOMAIN_EVENT_TYPES</code> registry.
            </p>
          </div>

          {/* Enabled Switch */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 p-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Enable Rule Immediately</div>
              <div className="text-[11.5px] text-muted-foreground">
                Active rules evaluate automatically when domain events occur.
              </div>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {/* Conditions Builder */}
          <div className="pt-2 border-t border-border/60">
            <ConditionBuilder conditions={conditions} onChange={setConditions} />
          </div>

          {/* Action Builder */}
          <div className="pt-2 border-t border-border/60">
            <ActionBuilder actions={actions} onChange={setActions} />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-float"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Rule Changes" : "Create Automation Rule"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
