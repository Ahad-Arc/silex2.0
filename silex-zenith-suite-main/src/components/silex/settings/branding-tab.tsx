import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Palette,
  Loader2,
  Check,
  ShieldAlert,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getWorkspaceSettingsFn,
  updateWorkspaceSettingsFn,
  hexColorRegex,
} from "@/lib/server-functions/workspaces";

export function BrandingTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("member");

  // Form State
  const [primaryColor, setPrimaryColor] = useState("#0F172A");
  const [secondaryColor, setSecondaryColor] = useState("#1E293B");
  const [accentColor, setAccentColor] = useState("#7C3AED");
  const [logoUrl, setLogoUrl] = useState("");

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await getWorkspaceSettingsFn({});
      if (res?.workspace) {
        setUserRole(res.userRole || "member");
        setLogoUrl(res.workspace.logoUrl || "");
      }
      if (res?.settings?.brandingColors) {
        setPrimaryColor(res.settings.brandingColors.primary || "#0F172A");
        setSecondaryColor(res.settings.brandingColors.secondary || "#1E293B");
        setAccentColor(res.settings.brandingColors.accent || "#7C3AED");
      }
    } catch (err: any) {
      toast.error("Failed to load branding settings", {
        description: err?.message || "Please refresh and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const canEdit = userRole === "admin" || userRole === "owner";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error("Permission denied", {
        description: "Only workspace administrators and owners can update branding.",
      });
      return;
    }

    if (!hexColorRegex.test(primaryColor.trim())) {
      toast.error("Validation Error", { description: "Primary color must be a valid hex code (e.g. #0F172A)." });
      return;
    }

    if (secondaryColor.trim() && !hexColorRegex.test(secondaryColor.trim())) {
      toast.error("Validation Error", { description: "Secondary color must be a valid hex code." });
      return;
    }

    if (accentColor.trim() && !hexColorRegex.test(accentColor.trim())) {
      toast.error("Validation Error", { description: "Accent color must be a valid hex code." });
      return;
    }

    if (logoUrl.trim() && !logoUrl.trim().startsWith("http://") && !logoUrl.trim().startsWith("https://")) {
      toast.error("Validation Error", { description: "Logo URL must be a valid HTTP or HTTPS address." });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateWorkspaceSettingsFn({
        data: {
          logoUrl: logoUrl.trim() || null,
          brandingColors: {
            primary: primaryColor.trim(),
            secondary: secondaryColor.trim() || undefined,
            accent: accentColor.trim() || undefined,
          },
        },
      });

      toast.success("Branding updated", {
        description: "Workspace palette and logo URL updated successfully.",
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("silex_workspace_updated", {
            detail: {
              name: updated.workspace.name,
              planTier: updated.workspace.planTier,
              logoUrl: updated.workspace.logoUrl,
            },
          }),
        );
      }
    } catch (err: any) {
      toast.error("Save failed", {
        description: err?.message || "An unexpected error occurred while saving branding.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-violet" />
        <p className="text-[13px] text-muted-foreground">Loading branding settings…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-6">
      <div className="border-b border-border/60 pb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-display">Branding & Visual Identity</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Customize the color accents and public logo applied to invoices, receipts, and portal views.
          </p>
        </div>
        {!canEdit && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-medium">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>Read-only (Member)</span>
          </div>
        )}
      </div>

      {/* Live Palette Swatch Preview */}
      <div className="p-4 rounded-2xl border border-border/60 bg-card/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-violet" />
          <div>
            <div className="text-[13px] font-medium">Palette Preview</div>
            <div className="text-[11.5px] text-muted-foreground">Current workspace color hierarchy</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-background">
            <span className="h-4 w-4 rounded-full border border-border/40 shadow-sm" style={{ background: primaryColor }} />
            <span className="text-[11px] font-mono text-muted-foreground">Primary</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-background">
            <span className="h-4 w-4 rounded-full border border-border/40 shadow-sm" style={{ background: secondaryColor }} />
            <span className="text-[11px] font-mono text-muted-foreground">Secondary</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-background">
            <span className="h-4 w-4 rounded-full border border-border/40 shadow-sm" style={{ background: accentColor }} />
            <span className="text-[11px] font-mono text-muted-foreground">Accent</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Colors Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-[12.5px] font-medium block mb-1.5">Primary Color</label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
              <input
                type="color"
                value={primaryColor.startsWith("#") ? primaryColor : "#0F172A"}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={!canEdit || isSaving}
                className="h-6 w-6 rounded border-0 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={!canEdit || isSaving}
                maxLength={7}
                placeholder="#0F172A"
                className="flex-1 bg-transparent outline-none text-[13px] font-mono uppercase min-w-0 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="text-[12.5px] font-medium block mb-1.5">Secondary Color</label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
              <input
                type="color"
                value={secondaryColor.startsWith("#") ? secondaryColor : "#1E293B"}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={!canEdit || isSaving}
                className="h-6 w-6 rounded border-0 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={!canEdit || isSaving}
                maxLength={7}
                placeholder="#1E293B"
                className="flex-1 bg-transparent outline-none text-[13px] font-mono uppercase min-w-0 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="text-[12.5px] font-medium block mb-1.5">Accent Color</label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
              <input
                type="color"
                value={accentColor.startsWith("#") ? accentColor : "#7C3AED"}
                onChange={(e) => setAccentColor(e.target.value)}
                disabled={!canEdit || isSaving}
                className="h-6 w-6 rounded border-0 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                disabled={!canEdit || isSaving}
                maxLength={7}
                placeholder="#7C3AED"
                className="flex-1 bg-transparent outline-none text-[13px] font-mono uppercase min-w-0 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Logo URL */}
        <div className="grid md:grid-cols-[220px_1fr] items-center gap-3 pt-2">
          <div>
            <div className="text-[13px] font-medium">Logo URL</div>
            <div className="text-[11.5px] text-muted-foreground">Direct link to your SVG or PNG brand logo.</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={!canEdit || isSaving}
              placeholder="https://your-domain.com/logo.svg"
              className="flex-1 bg-transparent outline-none text-[13px] min-w-0 disabled:opacity-60 font-mono"
            />
          </div>
        </div>

        {/* Action Button */}
        {canEdit && (
          <div className="pt-4 border-t border-border/50 flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl px-5 py-2 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Branding…
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Branding
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
