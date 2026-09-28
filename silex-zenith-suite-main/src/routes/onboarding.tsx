import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Briefcase,
  Palette,
  Building2,
  Code,
  PenTool,
  Sparkles,
  Loader2,
  Globe,
  Building,
  User,
} from "lucide-react";
import { SilexLogo } from "@/components/silex/logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/supabase";
import {
  getOnboardingStateFn,
  completeOnboardingFn,
  sanitizeWorkspaceSlug,
} from "@/lib/server-functions/onboarding";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — SILEX" },
      { name: "description", content: "Set up your SILEX workspace." },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Profile", "Business type", "Workspace", "You're in"];

const BUSINESS_TYPE_OPTIONS = [
  { id: "freelancer", icon: PenTool, label: "Freelancer", sub: "Independent, solo" },
  { id: "creative_studio", icon: Palette, label: "Creative studio", sub: "2–10 people" },
  { id: "agency", icon: Code, label: "Dev shop / agency", sub: "Engineering-led" },
  { id: "startup", icon: Building2, label: "Startup", sub: "Product company" },
  { id: "consultant", icon: Briefcase, label: "Consultant", sub: "Advisory or fractional" },
  { id: "other", icon: Sparkles, label: "Something else", sub: "Tell us more later" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

function Onboarding() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [isLoadingPrefill, setIsLoadingPrefill] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [businessType, setBusinessType] = useState("freelancer");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);

  // Provisioned result state
  const [provisionedWorkspace, setProvisionedWorkspace] = useState<{
    workspaceId: string;
    workspaceName: string;
    slug: string;
    currency: string;
  } | null>(null);

  // 1. Auth Guard
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate({
        to: "/auth",
        search: { redirect: "/onboarding" },
        replace: true,
      });
    }
  }, [isAuthenticated, isAuthLoading, navigate]);

  // 2. Fetch authenticated onboarding prefill
  useEffect(() => {
    let isMounted = true;

    async function loadPrefill() {
      try {
        const state = await getOnboardingStateFn();
        if (!isMounted) return;

        if (state.isAuthenticated && state.user) {
          const userFullName = state.user.fullName || "";
          setFullName(userFullName);

          if (state.profile?.companyName) {
            setCompanyName(state.profile.companyName);
          }
          if (state.profile?.website) {
            setWebsite(state.profile.website);
          }
          if (state.profile?.businessType) {
            setBusinessType(state.profile.businessType);
          }

          if (state.workspace) {
            setWorkspaceName(state.workspace.name);
            setWorkspaceSlug(state.workspace.slug);
            setCurrency(state.workspace.currency || "USD");
            setIsSlugCustomized(true);
          } else {
            const initialWsName = state.profile?.companyName || (userFullName ? `${userFullName}'s Workspace` : "My Workspace");
            setWorkspaceName(initialWsName);
            setWorkspaceSlug(sanitizeWorkspaceSlug(initialWsName));
          }
        }
      } catch (err) {
        console.error("Failed to load onboarding prefill:", err);
      } finally {
        if (isMounted) {
          setIsLoadingPrefill(false);
        }
      }
    }

    if (isAuthenticated) {
      loadPrefill();
    } else if (!isAuthLoading) {
      setIsLoadingPrefill(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAuthLoading]);

  // Handle Workspace Name Change & Auto-Slugify
  const handleWorkspaceNameChange = (val: string) => {
    setWorkspaceName(val);
    if (!isSlugCustomized) {
      setWorkspaceSlug(sanitizeWorkspaceSlug(val));
    }
    if (validationError) setValidationError(null);
  };

  const handleWorkspaceSlugChange = (val: string) => {
    setIsSlugCustomized(true);
    setWorkspaceSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    if (validationError) setValidationError(null);
  };

  // Step 0 -> Step 1
  const handleStep0Next = () => {
    if (!fullName.trim()) {
      setValidationError("Please enter your full name.");
      return;
    }
    setValidationError(null);

    // If workspace name is empty or default, suggest companyName or fullName
    if (!workspaceName.trim() || workspaceName === "My Workspace") {
      const suggestedName = companyName.trim() || `${fullName.trim()}'s Workspace`;
      setWorkspaceName(suggestedName);
      if (!isSlugCustomized) {
        setWorkspaceSlug(sanitizeWorkspaceSlug(suggestedName));
      }
    }

    setStep(1);
  };

  // Step 1 -> Step 2
  const handleStep1Next = () => {
    setValidationError(null);
    setStep(2);
  };

  // Step 2 -> Step 3 (Submit to backend)
  const handleStep2Submit = async () => {
    if (!workspaceName.trim()) {
      setValidationError("Please enter a workspace name.");
      return;
    }

    const cleanSlug = sanitizeWorkspaceSlug(workspaceSlug || workspaceName);
    if (cleanSlug.length < 2) {
      setValidationError("Please enter a valid workspace URL slug (at least 2 characters).");
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      const result = await completeOnboardingFn({
        data: {
          fullName: fullName.trim(),
          companyName: companyName.trim(),
          website: website.trim(),
          businessType,
          workspaceName: workspaceName.trim(),
          workspaceSlug: cleanSlug,
          currency,
        },
      });

      setProvisionedWorkspace(result);

      // Notify AppShell of workspace identity change
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("silex_workspace_updated", { detail: result }),
        );
      }

      toast.success("Workspace configured successfully!");
      setStep(3);
    } catch (err: any) {
      console.error("Onboarding failed:", err);
      const errMsg = err?.message || "Failed to configure workspace. Please try again.";
      setValidationError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || isLoadingPrefill) {
    return (
      <div className="min-h-screen bg-background bg-grain flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Preparing your setup…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grain flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border/60">
        <SilexLogo />
        <Link to="/app" className="text-[13px] text-muted-foreground hover:text-foreground">
          Skip for now
        </Link>
      </header>

      {/* Progress */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-10">
        <div className="flex items-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3 flex-1 last:flex-none">
              <div
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold transition",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-violet text-violet-foreground shadow-float"
                      : "border border-border bg-card text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[12px] font-medium",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border ml-1" />}
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 flex items-center">
        <div className="mx-auto w-full max-w-2xl px-6 py-16 animate-rise" key={step}>
          {validationError && (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
              {validationError}
            </div>
          )}

          {step === 0 && (
            <StepProfile
              fullName={fullName}
              setFullName={(v) => {
                setFullName(v);
                if (validationError) setValidationError(null);
              }}
              companyName={companyName}
              setCompanyName={setCompanyName}
              website={website}
              setWebsite={setWebsite}
            />
          )}

          {step === 1 && (
            <StepBusiness
              selected={businessType}
              onSelect={setBusinessType}
            />
          )}

          {step === 2 && (
            <StepWorkspace
              workspaceName={workspaceName}
              onWorkspaceNameChange={handleWorkspaceNameChange}
              workspaceSlug={workspaceSlug}
              onWorkspaceSlugChange={handleWorkspaceSlugChange}
              currency={currency}
              onCurrencyChange={setCurrency}
            />
          )}

          {step === 3 && (
            <StepDone
              workspaceName={provisionedWorkspace?.workspaceName || workspaceName}
              slug={provisionedWorkspace?.slug || workspaceSlug}
              currency={provisionedWorkspace?.currency || currency}
            />
          )}

          <div className="mt-10 flex items-center justify-between">
            <button
              onClick={() => {
                setValidationError(null);
                setStep((s) => Math.max(0, s - 1));
              }}
              className="text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={step === 0 || step === 3 || isSubmitting}
            >
              Back
            </button>

            {step === 0 && (
              <button
                onClick={handleStep0Next}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {step === 1 && (
              <button
                onClick={handleStep1Next}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleStep2Submit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-[13px] font-medium shadow-float hover:bg-primary/90 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating workspace…
                  </>
                ) : (
                  <>
                    Complete setup <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <Link
                to="/app"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-[13px] font-medium shadow-float hover:bg-primary/90 transition"
              >
                Enter workspace <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StepProfile({
  fullName,
  setFullName,
  companyName,
  setCompanyName,
  website,
  setWebsite,
}: {
  fullName: string;
  setFullName: (val: string) => void;
  companyName: string;
  setCompanyName: (val: string) => void;
  website: string;
  setWebsite: (val: string) => void;
}) {
  return (
    <div>
      <h1 className="text-4xl font-display tracking-tight">Let's set up your profile.</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        A few basics so your invoices and workspace feel like you.
      </p>
      <div className="mt-8 grid gap-4">
        <label className="block">
          <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground/80" /> Full name
          </span>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="flex-1 bg-transparent outline-none text-[14px]"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5 text-muted-foreground/80" /> Company or brand
          </span>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Studio"
              className="flex-1 bg-transparent outline-none text-[14px]"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground/80" /> Website
          </span>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. acme.studio"
              className="flex-1 bg-transparent outline-none text-[14px]"
            />
          </div>
        </label>
      </div>
    </div>
  );
}

function StepBusiness({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (val: string) => void;
}) {
  return (
    <div>
      <h1 className="text-4xl font-display tracking-tight">What kind of business?</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        We'll tailor invoice templates and reports.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        {BUSINESS_TYPE_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            className={cn(
              "text-left rounded-2xl border p-4 transition hover-lift cursor-pointer",
              selected === o.id
                ? "border-violet bg-violet/5 ring-1 ring-violet/50"
                : "border-border bg-card/60 hover:border-violet/50",
            )}
          >
            <o.icon
              className={cn("h-5 w-5", selected === o.id ? "text-violet" : "text-muted-foreground")}
            />
            <div className="mt-3 text-[14px] font-medium">{o.label}</div>
            <div className="text-[12px] text-muted-foreground">{o.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepWorkspace({
  workspaceName,
  onWorkspaceNameChange,
  workspaceSlug,
  onWorkspaceSlugChange,
  currency,
  onCurrencyChange,
}: {
  workspaceName: string;
  onWorkspaceNameChange: (val: string) => void;
  workspaceSlug: string;
  onWorkspaceSlugChange: (val: string) => void;
  currency: string;
  onCurrencyChange: (val: string) => void;
}) {
  return (
    <div>
      <h1 className="text-4xl font-display tracking-tight">Name your workspace.</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">You can invite teammates later.</p>
      <div className="mt-8 grid gap-4">
        <label className="block">
          <span className="text-[12px] font-medium text-muted-foreground">Workspace name</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
            <input
              value={workspaceName}
              onChange={(e) => onWorkspaceNameChange(e.target.value)}
              placeholder="e.g. Acme Studio"
              className="flex-1 bg-transparent outline-none text-[14px]"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-muted-foreground">Workspace URL</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-violet/60 transition">
            <span className="text-[13px] text-muted-foreground font-mono">silex.app/</span>
            <input
              value={workspaceSlug}
              onChange={(e) => onWorkspaceSlugChange(e.target.value)}
              placeholder="acme-studio"
              className="flex-1 bg-transparent outline-none text-[14px] font-mono"
            />
          </div>
        </label>

        <div>
          <div className="text-[12px] font-medium text-muted-foreground">Default currency</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCurrencyChange(c)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] transition cursor-pointer",
                  currency === c
                    ? "border-violet bg-violet/10 text-violet font-medium ring-1 ring-violet/50"
                    : "border-border bg-card/60 text-muted-foreground hover:border-violet/40 hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDone({
  workspaceName,
  slug,
  currency,
}: {
  workspaceName: string;
  slug: string;
  currency: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground shadow-float-lg">
        <Check className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-4xl font-display tracking-tight">You're all set.</h1>
      <p className="mt-3 max-w-md mx-auto text-[14px] text-muted-foreground">
        Your workspace <span className="font-semibold text-foreground">{workspaceName}</span> (
        <span className="font-mono text-[13px] text-foreground">silex.app/{slug}</span>) is ready
        with <span className="font-semibold text-foreground">{currency}</span> currency.
      </p>

      <div className="mt-6 p-4 rounded-xl border border-border/60 bg-card/40 max-w-sm mx-auto text-left space-y-2">
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">Workspace:</span>
          <span className="font-medium text-foreground">{workspaceName}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">URL Slug:</span>
          <span className="font-mono text-muted-foreground">{slug}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">Currency:</span>
          <span className="font-mono text-muted-foreground">{currency}</span>
        </div>
      </div>
    </div>
  );
}
