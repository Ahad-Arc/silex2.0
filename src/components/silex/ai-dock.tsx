import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Paperclip, Wand2, FileText, Mail, Users, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { icon: FileText, label: "Draft invoice for Acme Studio" },
  { icon: Mail, label: "Write a follow-up email for INV-2041" },
  { icon: Users, label: "Summarize Nova Labs relationship" },
  { icon: Wand2, label: "What's my Q3 revenue forecast?" },
];

type Msg = { role: "user" | "assistant"; text: string };

export function AiDock() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi — I'm SILEX. I can draft invoices, summarize clients, and answer anything about your business. What's on your mind?",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Here's a draft — I've pulled Acme's rate ($185/hr), last 3 line-item patterns, and applied your standard net-14 terms. Want me to send it for review?",
        },
      ]);
    }, 700);
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full",
          "bg-gradient-to-br from-primary via-violet to-primary text-primary-foreground",
          "shadow-float-lg hover:scale-105 transition-transform",
          "before:absolute before:inset-0 before:rounded-full before:animate-pulse-ring",
          open && "opacity-0 pointer-events-none",
        )}
        aria-label="Open SILEX AI"
      >
        <Sparkles className="h-6 w-6 relative" />
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)]",
          "rounded-3xl glass-strong shadow-float-lg overflow-hidden",
          "flex flex-col origin-bottom-right transition-all duration-300",
          open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4 pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">SILEX AI</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Ready
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "animate-rise",
                m.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[90%]",
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted/70 text-foreground rounded-bl-md",
                )}
              >
                {m.text}
              </div>
            </div>
          ))}

          {messages.length <= 1 && (
            <div className="pt-2 stagger">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Try asking</div>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => send(s.label)}
                    className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-left text-sm hover:border-violet/60 hover:bg-card transition"
                  >
                    <s.icon className="h-4 w-4 text-violet" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="p-3 border-t border-border/60"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:border-violet/60 transition">
            <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition">
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask SILEX anything..."
              rows={1}
              className="flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground min-w-0"
            />
            <button
              type="submit"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-40"
              disabled={!input.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
