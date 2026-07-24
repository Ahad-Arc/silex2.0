import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Zap, Shield, LineChart, Users, FileText, Command, CheckCircle2, Star } from "lucide-react";
import { SilexLogo } from "@/components/silex/logo";
import { Counter } from "@/components/silex/counter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SILEX — The operating system for your business" },
      { name: "description", content: "One beautiful workspace for freelancers, agencies, and startups to manage clients, invoices, payments, and revenue." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <SilexLogo />
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-muted-foreground">
            <a href="#product" className="hover:text-foreground transition">Product</a>
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#customers" className="hover:text-foreground transition">Customers</a>
            <a href="#changelog" className="hover:text-foreground transition">Changelog</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline text-[13px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 transition">
              Sign in
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-[13px] font-medium hover:bg-primary/90 shadow-float transition"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-aurora" />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/70 glass px-3 py-1 text-[12px] text-muted-foreground animate-rise">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-violet/15 text-violet">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
            Introducing SILEX AI — your business, one prompt away
          </div>
          <h1 className="mt-8 text-balance text-[64px] md:text-[88px] leading-[0.95] font-display animate-rise">
            The operating system<br />
            <span className="italic">for your</span> <span className="gradient-text">business.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-balance text-[17px] leading-relaxed text-muted-foreground animate-rise">
            SILEX replaces the pile of tools you use to run your work — clients, contracts, invoices, payments, and revenue — with one calm, beautifully designed workspace.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3 animate-rise">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-[14px] font-medium shadow-float-lg hover:bg-primary/90 transition"
            >
              Start free for 14 days
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-3 text-[14px] font-medium hover:border-violet/60 transition"
            >
              <Command className="h-4 w-4" /> View live demo
            </Link>
          </div>
          <div className="mt-4 text-[12px] text-muted-foreground">No credit card required · Cancel anytime</div>

          {/* Hero product preview */}
          <div className="mt-20 mx-auto max-w-6xl animate-rise">
            <div className="relative rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl p-2 shadow-float-lg">
              <div className="absolute -inset-x-20 -top-20 h-40 bg-gradient-to-b from-violet/20 to-transparent blur-3xl -z-10" />
              <div className="rounded-2xl bg-background overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  </div>
                  <div className="mx-auto flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> app.silex.com/workspace
                  </div>
                </div>
                <MockDashboard />
              </div>
            </div>
          </div>

          {/* Logo strip */}
          <div className="mt-24">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Trusted by independents at</div>
            <div className="mt-6 flex flex-wrap justify-center items-center gap-x-10 gap-y-4 text-lg font-display italic text-muted-foreground/70">
              <span>Stripe</span><span>Linear</span><span>Vercel</span><span>Notion</span><span>Figma</span><span>Anthropic</span><span>Ramp</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-6 py-16 border-y border-border/60">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { v: 2.4, s: "B+", label: "Processed on SILEX" },
            { v: 38000, s: "+", label: "Independent businesses" },
            { v: 4.9, s: "/5", label: "App store rating", decimals: 1 },
            { v: 12, s: "min", label: "Median time to invoice" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl md:text-5xl font-display tracking-tight">
                <Counter value={s.v} suffix={s.s} decimals={s.decimals ?? 0} />
              </div>
              <div className="mt-2 text-[13px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-28">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-widest text-violet">Product</div>
          <h2 className="mt-3 text-5xl font-display tracking-tight text-balance">
            Everything you need. <span className="italic text-muted-foreground">Nothing you don't.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-6 stagger">
          <FeatureCard
            className="md:col-span-4 md:row-span-2"
            icon={LineChart}
            title="Revenue you can feel"
            body="See cash on hand, pending payouts, and Q-over-Q growth in one live view. Charts animate as data streams in."
            visual={<RevenueVisual />}
          />
          <FeatureCard
            className="md:col-span-2"
            icon={FileText}
            title="Invoices in seconds"
            body="AI drafts line items from a client conversation, applies your rate card, and sends net-14 terms."
          />
          <FeatureCard
            className="md:col-span-2"
            icon={Users}
            title="Every client, one page"
            body="Notes, contracts, invoices, and payments — organized like a magazine, not a database."
          />
          <FeatureCard
            className="md:col-span-3"
            icon={Sparkles}
            title="A silent partner"
            body="SILEX AI drafts emails, chases overdue invoices, and surfaces revenue risks before you notice."
          />
          <FeatureCard
            className="md:col-span-3"
            icon={Shield}
            title="Grown-up compliance"
            body="Tax-ready exports, VAT support, contracts with e-signature, and audit trails on every action."
          />
        </div>
      </section>

      {/* AI section */}
      <section className="relative overflow-hidden py-28">
        <div className="absolute inset-0 bg-aurora opacity-70" />
        <div className="relative mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-violet">SILEX AI</div>
            <h2 className="mt-3 text-5xl font-display tracking-tight text-balance">
              A partner that <span className="italic">doesn't sleep.</span>
            </h2>
            <p className="mt-6 text-[16px] text-muted-foreground max-w-md leading-relaxed">
              Ask SILEX to draft an invoice from a Slack thread. Follow up on a stalled payment. Summarize your top client. It reads your workspace so you don't have to.
            </p>
            <ul className="mt-8 space-y-3 text-[14px]">
              {[
                "Draft invoices & emails in your voice",
                "Summarize any client or project in one tap",
                "Forecast next month's revenue with confidence bands",
                "Flag late payments and draft the chase",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="rounded-3xl glass-strong shadow-float-lg p-5 space-y-3">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-primary to-violet text-primary-foreground">
                  <Sparkles className="h-3 w-3" />
                </span>
                SILEX AI · draft
              </div>
              <div className="rounded-2xl bg-muted/50 px-4 py-3 text-[13.5px] leading-relaxed">
                Draft an invoice for Acme Studio — the Q3 brand refresh, 42 hours at $185, plus the license bundle.
              </div>
              <div className="rounded-2xl bg-card border border-border/70 px-4 py-3 text-[13.5px] leading-relaxed">
                Drafted <span className="font-medium">INV-2041</span> · $9,120 · Net-14. I pulled the line-item pattern from your last three Acme invoices and applied your standard terms. Ready to review.
              </div>
              <div className="flex gap-2 pt-2">
                <button className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-[12px] font-medium">Review invoice</button>
                <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium">Edit prompt</button>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-violet/30 blur-3xl -z-10" />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="customers" className="mx-auto max-w-7xl px-6 py-28">
        <h2 className="text-5xl font-display tracking-tight max-w-2xl text-balance">
          Loved by the people <span className="italic text-muted-foreground">who build alone.</span>
        </h2>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {[
            { name: "Maya Ito", role: "Brand designer, ITO Studio", quote: "It's the first business tool that feels like it was designed for the way I actually work. Beautifully quiet." },
            { name: "Jordan Reyes", role: "Founder, Foundry Type", quote: "I moved off six tools in a weekend. My invoices now feel as considered as the work inside them." },
            { name: "Priya Shah", role: "Independent consultant", quote: "SILEX AI drafts my follow-ups in my voice. I have never chased a payment again." },
          ].map((t) => (
            <div key={t.name} className="rounded-3xl border border-border/70 bg-card/60 p-6 hover-lift">
              <div className="flex gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
              </div>
              <p className="mt-4 text-[15px] leading-relaxed font-display">"{t.quote}"</p>
              <div className="mt-6 flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-violet text-primary-foreground text-[11px] font-semibold">
                  {t.name.split(" ").map(n => n[0]).join("")}
                </span>
                <div>
                  <div className="text-[13px] font-medium">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-widest text-violet">Pricing</div>
          <h2 className="mt-3 text-5xl font-display tracking-tight">Simple, honest pricing.</h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {[
            { name: "Solo", price: 0, sub: "Get started free", features: ["Up to 3 clients", "Unlimited invoices", "Basic analytics", "Community support"] },
            { name: "Studio", price: 19, sub: "For working independents", featured: true, features: ["Unlimited clients", "SILEX AI assistant", "Custom domains & branding", "Priority support", "Tax-ready exports"] },
            { name: "Agency", price: 49, sub: "For teams up to 10", features: ["Everything in Studio", "Team workspaces", "Advanced permissions", "SSO & audit logs", "Dedicated CSM"] },
          ].map((p) => (
            <div
              key={p.name}
              className={`rounded-3xl p-7 hover-lift ${
                p.featured
                  ? "bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-float-lg"
                  : "border border-border/70 bg-card/60"
              }`}
            >
              <div className="text-[12px] uppercase tracking-widest opacity-80">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1 font-display">
                <span className="text-5xl">${p.price}</span>
                <span className="text-sm opacity-70">/mo</span>
              </div>
              <div className="mt-1 text-[13px] opacity-70">{p.sub}</div>
              <button
                className={`mt-6 w-full rounded-xl py-2.5 text-[13px] font-medium transition ${
                  p.featured ? "bg-white/15 hover:bg-white/25" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                Start with {p.name}
              </button>
              <ul className="mt-6 space-y-2 text-[13px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 items-center">
                    <CheckCircle2 className="h-3.5 w-3.5 opacity-70" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-primary text-primary-foreground p-12 md:p-20 text-center shadow-float-lg">
          <div className="absolute inset-0 bg-mesh-dark opacity-80" />
          <div className="relative">
            <h2 className="text-5xl md:text-6xl font-display tracking-tight text-balance">
              Your business, <span className="italic">calmly run.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-[16px] opacity-80">
              Start your 14-day trial. No credit card, no lock-in. Bring your work home.
            </p>
            <Link
              to="/auth"
              className="mt-10 inline-flex items-center gap-2 rounded-xl bg-white text-primary px-6 py-3 text-[14px] font-medium hover:bg-white/90 transition"
            >
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <SilexLogo />
            <span>© 2026 SILEX Systems, Inc.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Security</a>
            <a href="#" className="hover:text-foreground">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  className = "",
  visual,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  className?: string;
  visual?: React.ReactNode;
}) {
  return (
    <div className={`rounded-3xl border border-border/70 bg-card/70 p-7 hover-lift relative overflow-hidden ${className}`}>
      <div className="relative">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/8 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="mt-5 text-xl font-display tracking-tight">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground max-w-sm">{body}</p>
      </div>
      {visual && <div className="mt-6 relative">{visual}</div>}
    </div>
  );
}

function RevenueVisual() {
  return (
    <div className="rounded-2xl bg-background border border-border/60 p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Revenue · MTD</div>
          <div className="mt-1 text-4xl font-display">
            $<Counter value={128420} />
          </div>
        </div>
        <div className="rounded-full bg-success/10 text-success text-[11px] font-medium px-2 py-0.5">
          +24.6%
        </div>
      </div>
      <svg viewBox="0 0 400 120" className="mt-5 w-full h-24">
        <defs>
          <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.58 0.28 295)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.58 0.28 295)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,80 C40,70 70,90 110,60 C150,30 190,50 230,35 C270,20 310,45 350,25 L400,20 L400,120 L0,120 Z" fill="url(#lg)" />
        <path d="M0,80 C40,70 70,90 110,60 C150,30 190,50 230,35 C270,20 310,45 350,25 L400,20" fill="none" stroke="oklch(0.32 0.14 275)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function MockDashboard() {
  return (
    <div className="grid grid-cols-12 gap-3 p-5 bg-background">
      <div className="col-span-3 space-y-3">
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Workspace</div>
          <div className="mt-2 space-y-1">
            {["Dashboard", "Clients", "Invoices", "Payments", "Analytics"].map((l, i) => (
              <div key={l} className={`text-[11px] rounded-md px-2 py-1 ${i === 0 ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>{l}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="col-span-9 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: "Revenue", v: "$128.4k", c: "text-primary" },
            { l: "Pending", v: "$18.2k", c: "text-warning" },
            { l: "Paid", v: "$92.1k", c: "text-success" },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k.l}</div>
              <div className={`mt-1 text-lg font-display ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="text-[11px] font-medium">Cash flow · 30d</div>
          <svg viewBox="0 0 400 80" className="mt-2 w-full h-16">
            <path d="M0,60 C50,55 80,20 120,30 C160,40 200,15 240,25 C280,35 320,10 400,20" fill="none" stroke="oklch(0.58 0.28 295)" strokeWidth="1.8" />
          </svg>
        </div>
      </div>
    </div>
  );
}
