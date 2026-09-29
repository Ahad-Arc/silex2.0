import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Camera,
  Github,
  Globe,
  Twitter,
  MapPin,
  Mail,
  LogOut,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit,
  FolderGit2,
} from "lucide-react";
import { useAuth } from "@/lib/supabase";
import {
  getUserProfileFn,
  type UserProfileResponse,
} from "@/lib/server-functions/profile";
import { EditProfileModal } from "@/components/silex/profile/edit-profile-modal";

export const Route = createFileRoute("/app/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SILEX" },
      { name: "description", content: "Your personal and professional profile." },
    ],
  }),
  component: Profile,
});

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "SX";
}

function Profile() {
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      navigate({ to: "/auth", replace: true });
    } catch {
      navigate({ to: "/auth", replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  const loadProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getUserProfileFn();
      setProfileData(data);
      setImageError(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load user profile. Please try again.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleProfileUpdated = (updated: UserProfileResponse) => {
    setProfileData(updated);
    setImageError(false);
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center space-y-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <p className="text-[14px] text-muted-foreground font-medium">
          Loading profile...
        </p>
      </div>
    );
  }

  // Error State
  if (loadError || !profileData) {
    return (
      <div className="max-w-4xl mx-auto py-16">
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-display tracking-tight text-foreground">
              Unable to load profile
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {loadError || "An unexpected error occurred while loading your profile."}
            </p>
          </div>
          <button
            type="button"
            onClick={loadProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition shadow-float"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { user, profile, preferences } = profileData;
  const fullName = user.fullName || authUser?.email?.split("@")[0] || "User";
  const initials = getInitials(user.fullName, user.email);
  const headline = [
    profile.jobTitle,
    profile.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-4xl mx-auto space-y-6 stagger">
      {/* Cover and Hero Header */}
      <div className="relative rounded-3xl overflow-hidden shadow-float">
        <div className="h-48 bg-mesh-dark bg-primary relative">
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
        </div>
        <div className="px-6 pb-6 -mt-14 bg-card border-x border-b border-border/70 rounded-b-3xl">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-4">
              <div className="relative group">
                {user.avatarUrl && !imageError ? (
                  <img
                    src={user.avatarUrl}
                    alt={fullName}
                    onError={() => setImageError(true)}
                    className="h-28 w-28 rounded-3xl object-cover border-4 border-card shadow-float-lg bg-background"
                  />
                ) : (
                  <div className="grid h-28 w-28 place-items-center rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-3xl font-semibold border-4 border-card shadow-float-lg select-none">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  aria-label="Change profile photo"
                  className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-background border border-border shadow-float text-foreground hover:bg-muted/80 transition"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="pb-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-display tracking-tight text-foreground">
                    {fullName}
                  </h1>
                  {user.emailVerifiedAt && (
                    <span
                      title="Verified Email"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[13.5px] text-muted-foreground font-normal">
                  {headline || "No headline added yet"}
                </div>
              </div>
            </div>

            <div className="pb-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
              >
                <Edit className="h-3.5 w-3.5" /> Edit profile
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-3.5 py-2 text-[13px] font-medium hover:bg-destructive/20 transition disabled:opacity-50"
              >
                {isSigningOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Bio & Focus + Contact Card */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Bio Card */}
        <div className="md:col-span-2 rounded-3xl border border-border/70 bg-card/70 p-6 flex flex-col justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Bio & Focus
            </div>
            <p className="mt-3 text-[14.5px] leading-relaxed font-sans text-foreground/90 whitespace-pre-line">
              {profile.bio || (
                <span className="text-muted-foreground italic">
                  No bio provided yet. Click "Edit profile" to share your background, current focus, and availability.
                </span>
              )}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
              Focus Areas & Skills
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.skills && profile.skills.length > 0 ? (
                profile.skills.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[12px] text-foreground font-medium shadow-xs"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-muted-foreground italic">
                  No skill tags listed yet. Add skills in Edit Profile.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contact & Details Card */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-3.5 text-[13px]">
          <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
            Contact & Details
          </div>

          <div className="flex items-center gap-2.5 text-foreground/90 overflow-hidden">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate" title={user.email}>
              {user.email}
            </span>
          </div>

          {profile.website && (
            <div className="flex items-center gap-2.5 text-foreground/90 overflow-hidden">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={
                  profile.website.startsWith("http")
                    ? profile.website
                    : `https://${profile.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline text-primary flex items-center gap-1"
              >
                {profile.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}

          {profile.location && (
            <div className="flex items-center gap-2.5 text-foreground/90">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{profile.location}</span>
            </div>
          )}

          {profile.twitter && (
            <div className="flex items-center gap-2.5 text-foreground/90 overflow-hidden">
              <Twitter className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={`https://twitter.com/${profile.twitter.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline text-foreground"
              >
                @{profile.twitter.replace(/^@/, "")}
              </a>
            </div>
          )}

          {profile.github && (
            <div className="flex items-center gap-2.5 text-foreground/90 overflow-hidden">
              <Github className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={`https://github.com/${profile.github.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline text-foreground"
              >
                {profile.github.replace(/^@/, "")}
              </a>
            </div>
          )}

          <div className="pt-2 border-t border-border/50 space-y-1.5 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Timezone: {preferences.timezone}</span>
            </div>
            <div className="flex items-center justify-between text-[11.5px]">
              <span>Theme: {preferences.theme}</span>
              <span>
                Shortcuts: {preferences.keyboardShortcutsEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Work / Projects Directory Shortcut */}
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-violet" />
            <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Workspace Projects
            </div>
          </div>
          <Link
            to="/app/projects"
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            View Projects Directory →
          </Link>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Projects and client deliveries you collaborate on are organized in the Projects hub.
        </p>
      </div>

      {/* Edit Profile Modal Dialog */}
      <EditProfileModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        profileData={profileData}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
