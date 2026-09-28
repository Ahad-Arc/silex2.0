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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Loader2,
  User,
  Briefcase,
  MapPin,
  Globe,
  Twitter,
  Github,
  Sparkles,
  Clock,
  Palette,
  Camera,
  Keyboard,
} from "lucide-react";
import {
  updateUserProfileFn,
  type UserProfileResponse,
} from "@/lib/server-functions/profile";

export interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileData: UserProfileResponse | null;
  onProfileUpdated?: (updated: UserProfileResponse) => void;
  workspaceId?: string;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function EditProfileModal({
  open,
  onOpenChange,
  profileData,
  onProfileUpdated,
  workspaceId,
}: EditProfileModalProps) {
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [github, setGithub] = useState("");
  const [skillsString, setSkillsString] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset and prefill form when profileData changes or modal opens
  useEffect(() => {
    if (profileData && open) {
      setFullName(profileData.user.fullName || "");
      setJobTitle(profileData.profile.jobTitle || "");
      setAvatarUrl(profileData.user.avatarUrl || "");
      setBio(profileData.profile.bio || "");
      setLocation(profileData.profile.location || "");
      setWebsite(profileData.profile.website || "");
      setTwitter(profileData.profile.twitter || "");
      setGithub(profileData.profile.github || "");
      setSkillsString(
        profileData.profile.skills && profileData.profile.skills.length > 0
          ? profileData.profile.skills.join(", ")
          : "",
      );
      setTimezone(profileData.preferences.timezone || "UTC");
      setTheme(
        (profileData.preferences.theme as "dark" | "light" | "system") || "dark",
      );
      setKeyboardShortcutsEnabled(
        profileData.preferences.keyboardShortcutsEnabled ?? true,
      );
      setErrors({});
    }
  }, [profileData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate inputs
    const newErrors: Record<string, string> = {};
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      newErrors.fullName = "Full name is required.";
    }

    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar) {
      try {
        new URL(trimmedAvatar);
      } catch {
        newErrors.avatarUrl = "Please enter a valid URL (e.g. https://example.com/avatar.jpg).";
      }
    }

    const trimmedWebsite = website.trim();
    if (trimmedWebsite) {
      try {
        // Allow user to write with or without protocol
        const testUrl = trimmedWebsite.startsWith("http")
          ? trimmedWebsite
          : `https://${trimmedWebsite}`;
        new URL(testUrl);
      } catch {
        newErrors.website = "Please enter a valid website URL.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    // Parse comma-separated skills
    const parsedSkills = skillsString
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 20);

    try {
      const updated = await updateUserProfileFn({
        data: {
          workspaceId,
          fullName: trimmedName,
          avatarUrl: trimmedAvatar ? trimmedAvatar : null,
          jobTitle: jobTitle.trim() ? jobTitle.trim() : null,
          bio: bio.trim(),
          location: location.trim(),
          website: trimmedWebsite,
          twitter: twitter.trim().replace(/^@/, ""),
          github: github.trim().replace(/^@/, ""),
          skills: parsedSkills,
          timezone,
          theme,
          keyboardShortcutsEnabled,
        },
      });

      toast.success("Profile updated successfully");
      onProfileUpdated?.(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update profile. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-6 shadow-float-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet/10 text-violet">
              <User className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-display tracking-tight">
                Edit Profile
              </DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                Update your public persona, contact details, and workspace preferences.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Section: Identity */}
          <div className="space-y-4">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Identity & Avatar
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-fullname" className="text-[12.5px] font-medium">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="profile-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ariana Vale"
                    className="rounded-xl border-border bg-background text-[13px]"
                    disabled={isSubmitting}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-[12px] text-destructive">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-jobtitle" className="text-[12.5px] font-medium">
                  Job Title / Headline
                </Label>
                <Input
                  id="profile-jobtitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Founder & Design Director"
                  className="rounded-xl border-border bg-background text-[13px]"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-avatarurl" className="text-[12.5px] font-medium flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Avatar Image URL
              </Label>
              <Input
                id="profile-avatarurl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... or leave blank for initials"
                className="rounded-xl border-border bg-background text-[13px] font-mono text-[12px]"
                disabled={isSubmitting}
              />
              <p className="text-[11.5px] text-muted-foreground">
                Paste a public image URL, or leave empty to automatically display your initials badge ($0 storage).
              </p>
              {errors.avatarUrl && (
                <p className="text-[12px] text-destructive">{errors.avatarUrl}</p>
              )}
            </div>
          </div>

          {/* Section: Bio & Focus */}
          <div className="space-y-4 pt-2 border-t border-border/60">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Bio & Focus Tags
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-bio" className="text-[12.5px] font-medium">
                Short Bio
              </Label>
              <Textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell clients and collaborators about your focus, experience, and availability..."
                className="rounded-xl border-border bg-background text-[13px] leading-relaxed resize-none"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-skills" className="text-[12.5px] font-medium">
                Skills / Focus Areas (Comma separated)
              </Label>
              <Input
                id="profile-skills"
                value={skillsString}
                onChange={(e) => setSkillsString(e.target.value)}
                placeholder="Brand, Product design, Typography, Editorial, Founder-led"
                className="rounded-xl border-border bg-background text-[13px]"
                disabled={isSubmitting}
              />
              <p className="text-[11.5px] text-muted-foreground">
                Separate skills with commas. Up to 20 tags will be rendered as highlight pills.
              </p>
            </div>
          </div>

          {/* Section: Contact & Social */}
          <div className="space-y-4 pt-2 border-t border-border/60">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Contact & Social Presence
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-location" className="text-[12.5px] font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" /> Location
                </Label>
                <Input
                  id="profile-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Brooklyn, NY"
                  className="rounded-xl border-border bg-background text-[13px]"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-website" className="text-[12.5px] font-medium flex items-center gap-1">
                  <Globe className="h-3 w-3 text-muted-foreground" /> Website / Portfolio
                </Label>
                <Input
                  id="profile-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. https://ariana.studio"
                  className="rounded-xl border-border bg-background text-[13px]"
                  disabled={isSubmitting}
                />
                {errors.website && (
                  <p className="text-[12px] text-destructive">{errors.website}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-twitter" className="text-[12.5px] font-medium flex items-center gap-1">
                  <Twitter className="h-3 w-3 text-muted-foreground" /> Twitter / X Handle
                </Label>
                <Input
                  id="profile-twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="e.g. arianavale"
                  className="rounded-xl border-border bg-background text-[13px]"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-github" className="text-[12.5px] font-medium flex items-center gap-1">
                  <Github className="h-3 w-3 text-muted-foreground" /> GitHub Username
                </Label>
                <Input
                  id="profile-github"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="e.g. arianavale"
                  className="rounded-xl border-border bg-background text-[13px]"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Section: Preferences */}
          <div className="space-y-4 pt-2 border-t border-border/60">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Preferences & Localization
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-timezone" className="text-[12.5px] font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" /> Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone} disabled={isSubmitting}>
                  <SelectTrigger id="profile-timezone" className="rounded-xl border-border bg-background text-[13px]">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-theme" className="text-[12.5px] font-medium flex items-center gap-1">
                  <Palette className="h-3 w-3 text-muted-foreground" /> Theme Mode
                </Label>
                <Select
                  value={theme}
                  onValueChange={(val: "dark" | "light" | "system") => setTheme(val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="profile-theme" className="rounded-xl border-border bg-background text-[13px]">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark (SILEX Default)</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System Synchronized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <div className="space-y-0.5">
                <div className="text-[13px] font-medium flex items-center gap-1.5">
                  <Keyboard className="h-3.5 w-3.5 text-muted-foreground" /> Keyboard Shortcuts
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  Enable rapid navigation hotkeys (e.g. ⌘K Command Menu, ⌘/ Search)
                </div>
              </div>
              <Switch
                checked={keyboardShortcutsEnabled}
                onCheckedChange={setKeyboardShortcutsEnabled}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] shadow-float"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving changes...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
