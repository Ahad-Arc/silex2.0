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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Building2, MapPin, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { updateClientFn } from "@/lib/server-functions/crm";

export interface EditClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string;
    companyName: string;
    website?: string | null;
    status?: string;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    } | null;
    shippingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    } | null;
    customFields?: Record<string, any> | null;
  } | null;
  onClientUpdated?: (updatedClient: any) => void;
}

export function EditClientModal({
  open,
  onOpenChange,
  client,
  onClientUpdated,
}: EditClientModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("Active");

  // Billing Address
  const [billingStreet, setBillingStreet] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [billingCountry, setBillingCountry] = useState("");

  // Shipping Address
  const [shippingStreet, setShippingStreet] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");

  // Collapsible sections
  const [showAddresses, setShowAddresses] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [customFieldsJson, setCustomFieldsJson] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when client changes or modal opens
  useEffect(() => {
    if (client && open) {
      setCompanyName(client.companyName || "");
      setWebsite(client.website || "");
      setStatus(client.status || "Active");

      const b = client.billingAddress || {};
      setBillingStreet(b.street || "");
      setBillingCity(b.city || "");
      setBillingState(b.state || "");
      setBillingPostalCode(b.postalCode || "");
      setBillingCountry(b.country || "");

      const s = client.shippingAddress || {};
      setShippingStreet(s.street || "");
      setShippingCity(s.city || "");
      setShippingState(s.state || "");
      setShippingPostalCode(s.postalCode || "");
      setShippingCountry(s.country || "");

      if (client.customFields && Object.keys(client.customFields).length > 0) {
        setCustomFieldsJson(JSON.stringify(client.customFields, null, 2));
      } else {
        setCustomFieldsJson("");
      }

      setErrorMsg(null);
    }
  }, [client, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    const trimmedName = companyName.trim();
    if (!trimmedName) {
      setErrorMsg("Company name is required.");
      return;
    }

    let parsedCustomFields: Record<string, any> | undefined = undefined;
    if (customFieldsJson.trim()) {
      try {
        parsedCustomFields = JSON.parse(customFieldsJson);
        if (typeof parsedCustomFields !== "object" || Array.isArray(parsedCustomFields) || parsedCustomFields === null) {
          setErrorMsg("Custom fields must be a valid JSON object.");
          return;
        }
      } catch {
        setErrorMsg("Invalid JSON syntax in custom fields.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const hasBilling =
        billingStreet.trim() ||
        billingCity.trim() ||
        billingState.trim() ||
        billingPostalCode.trim() ||
        billingCountry.trim();

      const hasShipping =
        shippingStreet.trim() ||
        shippingCity.trim() ||
        shippingState.trim() ||
        shippingPostalCode.trim() ||
        shippingCountry.trim();

      const billingAddress = hasBilling
        ? {
            street: billingStreet.trim() || undefined,
            city: billingCity.trim() || undefined,
            state: billingState.trim() || undefined,
            postalCode: billingPostalCode.trim() || undefined,
            country: billingCountry.trim() || undefined,
          }
        : undefined;

      const shippingAddress = hasShipping
        ? {
            street: shippingStreet.trim() || undefined,
            city: shippingCity.trim() || undefined,
            state: shippingState.trim() || undefined,
            postalCode: shippingPostalCode.trim() || undefined,
            country: shippingCountry.trim() || undefined,
          }
        : undefined;

      const res = await updateClientFn({
        data: {
          clientId: client.id,
          companyName: trimmedName,
          website: website.trim() ? website.trim() : null,
          status,
          billingAddress,
          shippingAddress,
          customFields: parsedCustomFields,
        },
      });

      toast.success("Client details updated successfully");
      if (onClientUpdated && res.client) {
        onClientUpdated(res.client);
      }
      onOpenChange(false);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to update client details.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
        <DialogHeader className="border-b border-border/60 pb-3 text-left">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet/15 text-violet">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-display tracking-tight">Edit Client Profile</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update client company information, addresses, and CRM attributes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMsg && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[12.5px] text-destructive">
              {errorMsg}
            </div>
          )}

          {/* Primary Details */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="companyName" className="text-xs font-medium text-muted-foreground">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Studio"
                className="mt-1 h-9 rounded-xl border-border/70 bg-background/50 text-[13px] focus:border-violet/60"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="website" className="text-xs font-medium text-muted-foreground">
                  Website
                </Label>
                <div className="relative mt-1">
                  <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="acme.co"
                    className="h-9 pl-8 rounded-xl border-border/70 bg-background/50 text-[13px] focus:border-violet/60"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                  Status
                </Label>
                <div className="mt-1">
                  <Select
                    value={status}
                    onValueChange={setStatus}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="status" className="h-9 rounded-xl border-border/70 bg-background/50 text-[13px]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                      <SelectItem value="Paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Addresses */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <button
              type="button"
              onClick={() => setShowAddresses(!showAddresses)}
              className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground hover:text-primary transition"
            >
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Addresses (Billing & Shipping)
              </span>
              {showAddresses ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showAddresses && (
              <div className="mt-3 space-y-4 pt-2 border-t border-border/40 text-xs">
                {/* Billing */}
                <div className="space-y-2">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10.5px]">
                    Billing Address
                  </span>
                  <Input
                    value={billingStreet}
                    onChange={(e) => setBillingStreet(e.target.value)}
                    placeholder="Street Address"
                    className="h-8 rounded-lg text-xs"
                    disabled={isSubmitting}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                      placeholder="City"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                    <Input
                      value={billingState}
                      onChange={(e) => setBillingState(e.target.value)}
                      placeholder="State / Province"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={billingPostalCode}
                      onChange={(e) => setBillingPostalCode(e.target.value)}
                      placeholder="Postal / Zip Code"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                    <Input
                      value={billingCountry}
                      onChange={(e) => setBillingCountry(e.target.value)}
                      placeholder="Country"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Shipping */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10.5px]">
                    Shipping Address
                  </span>
                  <Input
                    value={shippingStreet}
                    onChange={(e) => setShippingStreet(e.target.value)}
                    placeholder="Street Address"
                    className="h-8 rounded-lg text-xs"
                    disabled={isSubmitting}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      placeholder="City"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                    <Input
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      placeholder="State / Province"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={shippingPostalCode}
                      onChange={(e) => setShippingPostalCode(e.target.value)}
                      placeholder="Postal / Zip Code"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                    <Input
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(e.target.value)}
                      placeholder="Country"
                      className="h-8 rounded-lg text-xs"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Custom Fields */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <button
              type="button"
              onClick={() => setShowCustomFields(!showCustomFields)}
              className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground hover:text-primary transition"
            >
              <span>Custom Fields (JSON)</span>
              {showCustomFields ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showCustomFields && (
              <div className="mt-2 pt-2 border-t border-border/40">
                <textarea
                  value={customFieldsJson}
                  onChange={(e) => setCustomFieldsJson(e.target.value)}
                  placeholder={`{\n  "leadSource": "Referral",\n  "tier": "Enterprise"\n}`}
                  rows={4}
                  className="w-full font-mono text-xs rounded-lg border border-border/70 bg-background/60 p-2 outline-none focus:border-violet/60"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Valid JSON object format for arbitrary custom attributes.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl border-border text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !companyName.trim()}
              className="rounded-xl bg-primary text-primary-foreground text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
