import { useEffect, useState } from "react";
import { Copy, Check, AlertTriangle, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface WebhookSecretModalProps {
  secret: string | null;
  onClose: () => void;
}

export function WebhookSecretModal({ secret, onClose }: WebhookSecretModalProps) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  // Clear states when secret changes
  useEffect(() => {
    setCopied(false);
    setAcknowledged(false);
  }, [secret]);

  if (!secret) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret!);
      setCopied(true);
      toast.success("Signing secret copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy secret. Please select and copy manually.");
    }
  }

  function handleDismiss() {
    if (!acknowledged) return;
    onClose();
  }

  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-display">
            <Key className="h-4 w-4 text-violet" /> Webhook Signing Secret Generated
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            This signing secret is used to generate HMAC-SHA256 signatures for payload verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-[12.5px]">
          <Alert variant="default" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-[13px] font-semibold">One-Time Secret Display</AlertTitle>
            <AlertDescription className="text-[12px] leading-relaxed">
              Save this secret immediately. For security reasons, it will <strong>NEVER</strong> be displayed again.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">HMAC Signing Secret</label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={secret}
                className="font-mono text-[12px] bg-muted/50 border-border/80 text-foreground flex-1 select-all"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0 h-9 gap-1.5 text-[12px]"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2">
            <Checkbox
              id="acknowledge-secret"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(!!checked)}
              className="mt-0.5"
            />
            <label
              htmlFor="acknowledge-secret"
              className="text-[12px] text-muted-foreground leading-snug cursor-pointer select-none"
            >
              I have copied and stored this signing secret in a secure location. I understand I cannot retrieve it later.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!acknowledged}
            onClick={handleDismiss}
            className="w-full sm:w-auto text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-float"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
