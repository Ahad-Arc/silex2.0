import React, { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, User, Mail, Phone, Briefcase, Star } from "lucide-react";
import {
  createClientContactFn,
  updateClientContactFn,
} from "@/lib/server-functions/crm";

export interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    jobTitle?: string | null;
    isPrimary?: boolean;
  } | null;
  onSuccess?: (contact: any) => void;
}

export function ContactModal({
  open,
  onOpenChange,
  clientId,
  contact,
  onSuccess,
}: ContactModalProps) {
  const isEditing = Boolean(contact?.id);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (contact) {
        setFirstName(contact.firstName || "");
        setLastName(contact.lastName || "");
        setEmail(contact.email || "");
        setPhone(contact.phone || "");
        setJobTitle(contact.jobTitle || "");
        setIsPrimary(Boolean(contact.isPrimary));
      } else {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setJobTitle("");
        setIsPrimary(false);
      }
      setErrorMsg(null);
    }
  }, [open, contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirstName) {
      setErrorMsg("First name is required.");
      return;
    }
    if (!trimmedLastName) {
      setErrorMsg("Last name is required.");
      return;
    }
    if (!trimmedEmail) {
      setErrorMsg("Email address is required.");
      return;
    }

    try {
      setIsSubmitting(true);

      if (isEditing && contact?.id) {
        const res = await updateClientContactFn({
          data: {
            clientId,
            contactId: contact.id,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            email: trimmedEmail,
            phone: phone.trim() || null,
            jobTitle: jobTitle.trim() || null,
            isPrimary,
          },
        });

        toast.success("Contact updated successfully");
        if (onSuccess && res?.contact) {
          onSuccess(res.contact);
        }
      } else {
        const res = await createClientContactFn({
          data: {
            clientId,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            email: trimmedEmail,
            phone: phone.trim() || null,
            jobTitle: jobTitle.trim() || null,
            isPrimary,
          },
        });

        toast.success("Contact added successfully");
        if (onSuccess && res?.contact) {
          onSuccess(res.contact);
        }
      }

      onOpenChange(false);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to save contact.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-float">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Key Contact" : "Add Key Contact"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "Update contact person details for invoices, updates, and deliverables."
              : "Register an individual contact person associated with this client profile."}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-first-name" className="text-xs font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                required
                className="h-9 rounded-xl border-border bg-background/50 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-last-name" className="text-xs font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                className="h-9 rounded-xl border-border bg-background/50 text-xs"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="contact-email" className="text-xs font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              required
              className="h-9 rounded-xl border-border bg-background/50 text-xs"
            />
          </div>

          {/* Phone & Job Title */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone" className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="h-9 rounded-xl border-border bg-background/50 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-title" className="text-xs font-medium flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                Job Title
              </Label>
              <Input
                id="contact-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="VP of Engineering"
                className="h-9 rounded-xl border-border bg-background/50 text-xs"
              />
            </div>
          </div>

          {/* Primary Designation Checkbox */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Checkbox
              id="contact-primary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(Boolean(checked))}
              className="mt-0.5"
            />
            <div className="space-y-0.5 leading-none">
              <Label
                htmlFor="contact-primary"
                className="text-xs font-medium cursor-pointer flex items-center gap-1"
              >
                <Star className="h-3 w-3 text-amber-500 fill-amber-500/20" />
                Set as Primary Contact
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Invoices, receipts, and primary email correspondence will default to this person.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition shadow-float"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : isEditing ? (
                "Update Contact"
              ) : (
                "Add Contact"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
