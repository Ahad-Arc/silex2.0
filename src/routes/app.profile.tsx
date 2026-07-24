import { createFileRoute } from "@tanstack/react-router";
import { Camera, Github, Globe, Twitter, MapPin, Mail } from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Profile — SILEX" }, { name: "description", content: "Your public profile." }] }),
  component: Profile,
});

function Profile() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 stagger">
      {/* Cover */}
      <div className="relative rounded-3xl overflow-hidden shadow-float">
        <div className="h-48 bg-mesh-dark bg-primary" />
        <div className="px-6 pb-6 -mt-14 bg-card">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="grid h-28 w-28 place-items-center rounded-3xl bg-gradient-to-br from-primary to-violet text-primary-foreground text-3xl font-semibold border-4 border-card shadow-float-lg">
                  AV
                </div>
                <button className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-background border border-border shadow-float">
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="pb-2">
                <h1 className="text-3xl font-display tracking-tight">Ariana Vale</h1>
                <div className="mt-0.5 text-[13px] text-muted-foreground">Founder, Ariana Studio · Brooklyn, NY</div>
              </div>
            </div>
            <div className="pb-2 flex gap-2">
              <button className="rounded-xl border border-border bg-card px-3 py-2 text-[13px] font-medium hover:border-violet/50 transition">Preview page</button>
              <button className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-[13px] font-medium shadow-float hover:bg-primary/90 transition">Edit profile</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Bio</div>
          <p className="mt-3 text-[15px] leading-relaxed font-display">
            Independent designer working with founders on brand and product identity. Previously at Anthropic, Figma, Ueno. Currently accepting Q4 clients.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Brand", "Product design", "Type", "Editorial", "Founder-led"].map((t) => (
              <span key={t} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11.5px] text-muted-foreground">{t}</span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 space-y-3 text-[13px]">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Contact</div>
          <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> ariana@studio.co</div>
          <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> ariana.studio</div>
          <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Brooklyn, NY</div>
          <div className="flex items-center gap-2"><Twitter className="h-3.5 w-3.5 text-muted-foreground" /> @arianavale</div>
          <div className="flex items-center gap-2"><Github className="h-3.5 w-3.5 text-muted-foreground" /> arianavale</div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
        <div className="flex items-center justify-between">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">Selected work</div>
          <button className="text-[12px] text-primary hover:underline">Manage</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { t: "Foundry Type", d: "Brand & marketing site" },
            { t: "Kite Club", d: "Membership app" },
            { t: "Orbit House", d: "Editorial system" },
          ].map((p) => (
            <div key={p.t} className="rounded-2xl overflow-hidden border border-border/70 bg-card hover-lift">
              <div className="h-32 bg-aurora" />
              <div className="p-4">
                <div className="text-[13.5px] font-medium">{p.t}</div>
                <div className="text-[12px] text-muted-foreground">{p.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
