import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowUp, Paperclip, FileText, Mail, Users, Wand2, Search, Clock } from "lucide-react";

export const Route = createFileRoute("/app/ai")({
  head: () => ({ meta: [{ title: "AI Assistant — SILEX" }, { name: "description", content: "Your always-on business partner." }] }),
  component: AiPage,
});

const SUGGESTIONS = [
  { i: FileText, l: "Draft invoice for Acme — Q3 retainer" },
  { i: Mail, l: "Write a warm follow-up for INV-2039" },
  { i: Users, l: "Summarize my relationship with Nova Labs" },
  { i: Wand2, l: "What's my Q3 revenue forecast?" },
  { i: Search, l: "Find every contract with a non-compete clause" },
  { i: Clock, l: "Who hasn't paid me in over 14 days?" },
];

type Msg = { role: "ai" | "user"; text: string };
function AiPage() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Hi Ariana — I'm SILEX. I read your entire workspace so you don't have to. Ask me anything about your business, or start with a suggestion." },
  ]);

  const send = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: "Here's what I found: your Q3 pipeline sits at $312k with 82% weighted probability. Two clients (Acme, Nova) account for 61% — I'd suggest 3 warm outreaches to reduce concentration risk. Want me to draft them?",
        },
      ]);
    }, 700);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 stagger">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet text-primary-foreground shadow-float">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-5xl font-display tracking-tight">SILEX AI</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Your always-on business partner. Ask anything.</p>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/70 overflow-hidden">
        <div className="p-6 space-y-4 min-h-[400px] max-h-[520px] overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`animate-rise ${m.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[90%]"}`}>
              {m.role === "ai" && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                  <span className="grid h-4 w-4 place-items-center rounded-sm bg-gradient-to-br from-primary to-violet text-primary-foreground">
                    <Sparkles className="h-2.5 w-2.5" />
                  </span>
                  SILEX
                </div>
              )}
              <div className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/60 rounded-bl-md"
              }`}>{m.text}</div>
            </div>
          ))}
        </div>

        {msgs.length <= 1 && (
          <div className="border-t border-border/60 p-6">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Try one of these</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s.l} onClick={() => send(s.l)} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left text-[13px] hover:border-violet/50 hover:bg-card transition">
                  <s.i className="h-4 w-4 text-violet shrink-0" /> {s.l}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border/60 p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-violet/60 transition">
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition">
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask SILEX about your business..."
              className="flex-1 resize-none bg-transparent py-2 text-[14px] outline-none placeholder:text-muted-foreground min-w-0"
            />
            <button type="submit" disabled={!input.trim()} className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition">
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
