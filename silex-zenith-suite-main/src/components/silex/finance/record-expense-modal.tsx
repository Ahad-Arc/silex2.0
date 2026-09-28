import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  DollarSign,
  Calendar,
  Building,
  FolderKanban,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
  Tag,
} from "lucide-react";
import { createExpenseFn, EXPENSE_CATEGORIES } from "@/lib/server-functions/expenses";
import { getProjectsFn } from "@/lib/server-functions/projects";

export interface RecordExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseRecorded?: () => void;
}

interface ProjectOption {
  id: string;
  name: string;
  code: string | null;
}

export function RecordExpenseModal({
  open,
  onOpenChange,
  onExpenseRecorded,
}: RecordExpenseModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("Software & SaaS");
  const [vendorName, setVendorName] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [projectId, setProjectId] = useState<string>("none");
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available projects for linking
  const [projectsList, setProjectsList] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (open) {
      async function loadProjects() {
        try {
          setLoadingProjects(true);
          const res = await getProjectsFn();
          if (res?.projects) {
            setProjectsList(
              res.projects.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
              }))
            );
          }
        } catch {
          // Non-blocking fallback if projects fail to load
          setProjectsList([]);
        } finally {
          setLoadingProjects(false);
        }
      }
      loadProjects();
    }
  }, [open]);

  const resetForm = () => {
    setAmount("");
    setCategory("Software & SaaS");
    setVendorName("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setProjectId("none");
    setReceiptUrl("");
    setError(null);
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

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid expense amount greater than $0.00.");
      return;
    }

    if (!category.trim()) {
      setError("Please select a category for this expense.");
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);

    try {
      setIsSubmitting(true);

      await createExpenseFn({
        data: {
          amountCents,
          category: category.trim(),
          vendorName: vendorName.trim() || undefined,
          expenseDate: new Date(expenseDate).toISOString(),
          projectId: projectId !== "none" ? projectId : undefined,
          receiptUrl: receiptUrl.trim() || undefined,
          currency: "USD",
        },
      });

      toast.success(
        `Expense of $${parsedAmount.toFixed(2)} recorded for ${vendorName || category}!`
      );
      resetForm();
      onOpenChange(false);
      onExpenseRecorded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/70 shadow-float-lg p-0 overflow-hidden rounded-3xl">
        <form onSubmit={handleSubmit} className="space-y-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <Receipt className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-display tracking-tight">
                  Record Expense
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Track operational costs, vendor payouts, and project expenses.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount & Category row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expense-amount" className="text-xs font-medium text-foreground">
                  Amount (USD) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="pl-8 text-sm font-mono h-9 rounded-xl bg-background/50 border-border/80"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-category" className="text-xs font-medium text-foreground">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="expense-category" className="h-9 rounded-xl bg-background/50 border-border/80 text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Select category" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl bg-card border-border/80">
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vendor Name */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-vendor" className="text-xs font-medium text-foreground">
                Vendor / Payee
              </Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="expense-vendor"
                  placeholder="e.g. AWS, Figma, Google Workspace, WeWork"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  maxLength={255}
                  className="pl-8 text-xs h-9 rounded-xl bg-background/50 border-border/80"
                />
              </div>
            </div>

            {/* Date & Project row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expense-date" className="text-xs font-medium text-foreground">
                  Date
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="pl-8 text-xs h-9 rounded-xl bg-background/50 border-border/80"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-project" className="text-xs font-medium text-foreground">
                  Link to Project (Optional)
                </Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger id="expense-project" className="h-9 rounded-xl bg-background/50 border-border/80 text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <FolderKanban className="h-3 w-3 text-muted-foreground shrink-0" />
                      <SelectValue placeholder={loadingProjects ? "Loading..." : "None"} />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-52 rounded-xl bg-card border-border/80">
                    <SelectItem value="none" className="text-xs">
                      None (General Workspace)
                    </SelectItem>
                    {projectsList.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.code ? `[${p.code}] ` : ""}{p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Receipt URL / Reference */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="expense-receipt" className="text-xs font-medium text-foreground">
                  Receipt URL or Reference
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  $0 storage · Link or ID
                </span>
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="expense-receipt"
                  placeholder="https://... or receipt reference #REC-102"
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  maxLength={2048}
                  className="pl-8 text-xs h-9 rounded-xl bg-background/50 border-border/80 font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="rounded-xl text-xs h-9 bg-primary text-primary-foreground font-medium shadow-float hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Recording…
                </>
              ) : (
                "Record Expense"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
