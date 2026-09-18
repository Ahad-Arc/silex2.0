import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ConditionRule {
  fieldPath: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
  value: string;
}

interface ConditionBuilderProps {
  conditions: ConditionRule[];
  onChange: (conditions: ConditionRule[]) => void;
}

const ALLOWED_OPERATORS = [
  { value: "eq", label: "Equals (eq)" },
  { value: "neq", label: "Not Equals (neq)" },
  { value: "gt", label: "Greater Than (gt)" },
  { value: "gte", label: "Greater Than or Equal (gte)" },
  { value: "lt", label: "Less Than (lt)" },
  { value: "lte", label: "Less Than or Equal (lte)" },
  { value: "contains", label: "Contains (contains)" },
  { value: "in", label: "In Target Array (in)" },
];

export function ConditionBuilder({ conditions, onChange }: ConditionBuilderProps) {
  function addCondition() {
    onChange([...conditions, { fieldPath: "event.payload.status", operator: "eq", value: "" }]);
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, key: keyof ConditionRule, val: string) {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [key]: val };
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-[13px] font-medium text-foreground">Trigger Conditions</label>
          <p className="text-[11.5px] text-muted-foreground">
            Evaluation rules matching event payload values (e.g. <code>event.payload.amountCents &gt;= 50000</code>).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addCondition}
          className="h-7 text-[11.5px] gap-1"
        >
          <Plus className="h-3 w-3" /> Add Condition
        </Button>
      </div>

      {conditions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-[12px] text-muted-foreground">
          No trigger conditions configured. Rule will execute on all matching domain events.
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((cond, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr_36px] items-center gap-2 rounded-xl border border-border/70 bg-background/60 p-2.5"
            >
              <Input
                placeholder="event.payload.amountCents"
                value={cond.fieldPath}
                onChange={(e) => updateCondition(idx, "fieldPath", e.target.value)}
                className="h-8 text-[12px] font-mono"
              />

              <Select
                value={cond.operator}
                onValueChange={(val) => updateCondition(idx, "operator", val)}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-[12px]">
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Value (e.g. paid, 5000)"
                value={cond.value}
                onChange={(e) => updateCondition(idx, "value", e.target.value)}
                className="h-8 text-[12px]"
              />

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeCondition(idx)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
